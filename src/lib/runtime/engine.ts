import { chat, chatWithTools } from "@/lib/claude";
import type { MessageParam, Tool } from "@/lib/claude";
import type { AgentConfig } from "@/lib/types";
import type { RuntimeMessage, ProcessMessageResult, SessionUpdates } from "./types";
import type { McpServerDefinition, ToolCall, ToolUseRecord } from "./tools.types";
import { checkPreMessage } from "./guardrails";
import { McpClientManager } from "./mcp-client";

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_MAX_TOOL_ROUNDTRIPS = 10;
const MAX_HISTORY_MESSAGES = 40;

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

    const status: SessionUpdates["status"] =
      preCheck.action === "end_session" ? "ended" : sessionStatus as SessionUpdates["status"];

    return {
      response: blockedResponse,
      sessionUpdates: { turnCount, failedAttempts, status },
      guardrailNotice: preCheck.reason,
    };
  }

  // 2. Determine maxTokens from guardrails
  const maxResponseLength = guardrails?.resource_limits?.max_response_length;
  const maxTokens = maxResponseLength ? Math.min(maxResponseLength, 4096) : undefined;

  // 3. Route to the appropriate path
  let responseText: string;
  let toolExecutions: ToolUseRecord[] | undefined;

  if (mcpServers?.length) {
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
    const messages = buildMessages(history, userMessage);
    responseText = await chat(
      systemPrompt,
      messages as Array<{ role: "user" | "assistant"; content: string }>,
      maxTokens ? { maxTokens } : undefined
    );
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
  const newStatus: SessionUpdates["status"] = newTurnCount >= maxTurns ? "ended" : "active";

  return {
    response,
    sessionUpdates: {
      turnCount: newTurnCount,
      failedAttempts,
      status: newStatus,
    },
    guardrailNotice: newStatus === "ended" ? `Session ended: maximum ${maxTurns} turns reached.` : undefined,
    ...(toolExecutions ? { toolExecutions } : {}),
  };
}

// ── Shared helpers ───────────────────────────────────────────────────

/** Build a capped messages array from history plus a new user message. */
function buildMessages(
  history: RuntimeMessage[],
  userMessage: string
): MessageParam[] {
  const capped = history.slice(-MAX_HISTORY_MESSAGES);
  return [
    ...capped.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ];
}

/** Extract concatenated text from Anthropic content blocks. */
function extractText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text!)
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
    await mcpClient.connect(mcpServers);

    const tools = await mcpClient.toAnthropicTools();
    const messages: MessageParam[] = buildMessages(history, userMessage);
    const effectiveMaxTokens = maxTokens ?? 4096;

    // Agentic loop
    for (let iteration = 0; iteration < DEFAULT_MAX_TOOL_ROUNDTRIPS; iteration++) {
      const response = await chatWithTools(systemPrompt, messages, {
        tools: tools as Tool[],
        maxTokens: effectiveMaxTokens,
      });

      const content = response.content as Array<{
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }>;

      // If Claude finished with a text response or hit max_tokens, extract and return
      if (response.stop_reason !== "tool_use") {
        return { responseText: extractText(content), toolExecutions: allToolExecutions };
      }

      // Claude wants to use tools - append the full assistant message
      messages.push({
        role: "assistant",
        content: response.content as MessageParam["content"],
      });

      // Extract tool_use blocks and execute them
      const toolUseBlocks = content.filter((block) => block.type === "tool_use");

      const toolResultBlocks: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
        is_error?: boolean;
      }> = [];

      for (const block of toolUseBlocks) {
        const { serverName, toolName } = parseToolName(block.name!);
        const input = (block.input ?? {}) as Record<string, unknown>;

        const toolCall: ToolCall = {
          id: block.id!,
          name: block.name!,
          input,
          serverName,
        };

        const result = await mcpClient.executeTool(toolCall);

        allToolExecutions.push({
          toolCallId: block.id!,
          toolName,
          serverName,
          input,
          output: result.output,
          isError: result.isError,
          durationMs: result.durationMs,
        });

        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: block.id!,
          content: result.output,
          ...(result.isError ? { is_error: true } : {}),
        });
      }

      // Append user message containing all tool results
      messages.push({
        role: "user",
        content: toolResultBlocks as unknown as MessageParam["content"],
      });
    }

    // Max iterations reached -- make one final call with NO tools to force a text response
    const finalResponse = await chatWithTools(systemPrompt, messages, {
      maxTokens: effectiveMaxTokens,
    });

    const text = extractText(
      finalResponse.content as Array<{ type: string; text?: string }>
    );
    return { responseText: text, toolExecutions: allToolExecutions };
  } finally {
    await mcpClient.disconnect();
  }
}
