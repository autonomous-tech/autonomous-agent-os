import { chat, chatWithTools } from "@/lib/claude";
import type { MessageParam } from "@/lib/claude";
import type { AgentConfig } from "@/lib/types";
import type { RuntimeMessage, ProcessMessageResult } from "./types";
import type { McpServerDefinition, ToolCall, ToolUseRecord } from "./tools.types";
import { checkPreMessage } from "./guardrails";
import { McpClientManager } from "./mcp-client";

type ContentBlock = { type: string; text?: string; id?: string; name?: string; input?: unknown };

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_MAX_TOOL_ROUNDTRIPS = 10;

// ── Main entry point ─────────────────────────────────────────────────

/**
 * Process a user message against a deployed agent.
 * Returns the assistant response and any session updates.
 *
 * When `mcpServers` is provided, the engine enters an agentic loop that
 * lets Claude call MCP tools until it produces a final text response.
 */
export async function processMessage(
  systemPrompt: string,
  config: AgentConfig,
  sessionStatus: string,
  turnCount: number,
  failedAttempts: number,
  history: RuntimeMessage[],
  userMessage: string,
  mcpServers?: McpServerDefinition[]
): Promise<ProcessMessageResult> {
  const guardrails = config.guardrails;

  // 1. Pre-message guardrail check
  const preCheck = checkPreMessage(guardrails, turnCount, sessionStatus);
  if (!preCheck.allowed) {
    const blockedResponse: RuntimeMessage = {
      id: generateId(),
      role: "assistant",
      content: preCheck.reason || "This session is no longer active.",
      timestamp: new Date().toISOString(),
      metadata: { blocked: true, action: preCheck.action },
    };

    return {
      response: blockedResponse,
      sessionUpdates: {
        turnCount,
        failedAttempts,
        status: preCheck.action === "end_session" ? "ended" : sessionStatus as "active" | "ended" | "escalated",
      },
      guardrailNotice: preCheck.reason,
    };
  }

  // 2. Determine maxTokens from guardrails
  const maxResponseLength = guardrails?.resource_limits?.max_response_length;
  const maxTokens = maxResponseLength ? Math.min(maxResponseLength, 4096) : undefined;

  // 3. Route to the appropriate path
  const hasMcpServers = mcpServers && mcpServers.length > 0;

  let responseText: string;
  let toolExecutions: ToolUseRecord[] | undefined;

  if (hasMcpServers) {
    const result = await processWithTools(
      systemPrompt,
      history,
      userMessage,
      mcpServers,
      maxTokens
    );
    responseText = result.responseText;
    toolExecutions = result.toolExecutions.length > 0 ? result.toolExecutions : undefined;
  } else {
    // Existing chat() path — unchanged
    const cappedHistory = history.slice(-40);
    const claudeMessages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...cappedHistory.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userMessage },
    ];

    responseText = await chat(systemPrompt, claudeMessages, maxTokens ? { maxTokens } : undefined);
  }

  // 4. Build response message
  const response: RuntimeMessage = {
    id: generateId(),
    role: "assistant",
    content: responseText,
    timestamp: new Date().toISOString(),
    ...(toolExecutions ? { toolUses: toolExecutions } : {}),
  };

  // 5. Determine new session state
  const newTurnCount = turnCount + 1;
  const maxTurns = guardrails?.resource_limits?.max_turns_per_session ?? 50;
  const newStatus = newTurnCount >= maxTurns ? "ended" : "active";

  return {
    response,
    sessionUpdates: {
      turnCount: newTurnCount,
      failedAttempts,
      status: newStatus as "active" | "ended" | "escalated",
    },
    guardrailNotice: newStatus === "ended" ? `Session ended: maximum ${maxTurns} turns reached.` : undefined,
    ...(toolExecutions ? { toolExecutions } : {}),
  };
}

// ── Agentic tool-use loop ────────────────────────────────────────────

interface ToolLoopResult {
  responseText: string;
  toolExecutions: ToolUseRecord[];
}

/**
 * Run the agentic tool-use loop:
 *  1. Connect to MCP servers
 *  2. Call Claude with tools
 *  3. If Claude requests tool_use, execute tools and feed results back
 *  4. Repeat until Claude returns end_turn or max iterations reached
 *  5. Always disconnect MCP servers in finally block
 */
async function processWithTools(
  systemPrompt: string,
  history: RuntimeMessage[],
  userMessage: string,
  mcpServers: McpServerDefinition[],
  maxTokens?: number
): Promise<ToolLoopResult> {
  const mcpClient = new McpClientManager();
  const allToolExecutions: ToolUseRecord[] = [];

  try {
    // Connect to all configured MCP servers
    await mcpClient.connect(mcpServers);

    // Get Anthropic-formatted tool definitions
    const tools = await mcpClient.toAnthropicTools();

    // Build the initial messages array from history, using MessageParam format
    // so we can later append tool_use and tool_result content blocks.
    const cappedHistory = history.slice(-40);
    const messages: MessageParam[] = [
      ...cappedHistory.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userMessage },
    ];

    // Agentic loop
    for (let iteration = 0; iteration < DEFAULT_MAX_TOOL_ROUNDTRIPS; iteration++) {
      const response = await chatWithTools(systemPrompt, messages, {
        tools: tools as import("@anthropic-ai/sdk/resources/messages").Tool[],
        maxTokens: maxTokens ?? 4096,
      });

      // If Claude finished with a text response, extract it and return
      if (response.stop_reason === "end_turn") {
        const text = extractTextFromContent(response.content as ContentBlock[]);
        return { responseText: text, toolExecutions: allToolExecutions };
      }

      // If Claude wants to use tools
      if (response.stop_reason === "tool_use") {
        // Append the full assistant message (may contain text + tool_use blocks)
        messages.push({
          role: "assistant",
          content: response.content as MessageParam["content"],
        });

        // Extract tool_use blocks
        const toolUseBlocks = (response.content as ContentBlock[]).filter(
          (block): block is ContentBlock & { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
            block.type === "tool_use"
        );

        // Execute each tool call and collect results
        const toolResultBlocks: Array<{
          type: "tool_result";
          tool_use_id: string;
          content: string;
          is_error?: boolean;
        }> = [];

        for (const block of toolUseBlocks) {
          // Parse "serverName__toolName" to resolve the server
          const { serverName, toolName } = parseToolName(block.name);

          const toolCall: ToolCall = {
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
            serverName,
          };

          const result = await mcpClient.executeTool(toolCall);

          // Record this tool execution
          allToolExecutions.push({
            toolCallId: block.id,
            toolName,
            serverName,
            input: block.input as Record<string, unknown>,
            output: result.output,
            isError: result.isError,
            durationMs: result.durationMs,
          });

          // Build the tool_result content block
          toolResultBlocks.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result.output,
            ...(result.isError ? { is_error: true } : {}),
          });
        }

        // Append user message containing all tool results
        messages.push({
          role: "user",
          content: toolResultBlocks as unknown as MessageParam["content"],
        });

        // Continue to next iteration of the loop
        continue;
      }

      // For any other stop_reason (e.g. max_tokens), extract whatever text we have
      const text = extractTextFromContent(response.content as ContentBlock[]);
      return { responseText: text, toolExecutions: allToolExecutions };
    }

    // Max iterations reached — make one final call with NO tools to force a text response
    const finalResponse = await chatWithTools(systemPrompt, messages, {
      maxTokens: maxTokens ?? 4096,
      // No tools provided — forces Claude to produce text
    });

    const text = extractTextFromContent(finalResponse.content as ContentBlock[]);
    return { responseText: text, toolExecutions: allToolExecutions };
  } finally {
    await mcpClient.disconnect();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Extract concatenated text from Anthropic content blocks.
 */
function extractTextFromContent(
  content: ContentBlock[]
): string {
  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("");
}

/**
 * Parse a prefixed tool name "serverName__toolName" into its components.
 * If no prefix separator is found, returns the full name as both.
 */
function parseToolName(prefixedName: string): { serverName: string; toolName: string } {
  const separatorIndex = prefixedName.indexOf("__");
  if (separatorIndex === -1) {
    return { serverName: prefixedName, toolName: prefixedName };
  }
  return {
    serverName: prefixedName.slice(0, separatorIndex),
    toolName: prefixedName.slice(separatorIndex + 2),
  };
}

function generateId(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
