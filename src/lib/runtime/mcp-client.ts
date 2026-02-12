// ── MCP Client Manager ─────────────────────────────────────────────
// Manages short-lived MCP server connections for tool execution.
// Each server gets its own Client instance; tools are enumerated,
// filtered, and dispatched through this single manager.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import type {
  McpServerDefinition,
  ExecutableTool,
  ToolCall,
  ToolResult,
} from "@/lib/runtime/tools.types";

// ── Anthropic SDK tool shape (subset we need) ──────────────────────

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

// ── Defaults ───────────────────────────────────────────────────────

const DEFAULT_MAX_EXECUTION_MS = 30_000;
const DEFAULT_MAX_OUTPUT_SIZE = 102_400;

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Simple glob matching where `*` matches any sequence of characters.
 * Supports patterns like "read*", "*write", "fs_*_file", and exact matches.
 */
export function matchesGlob(pattern: string, name: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const regexStr = "^" + escaped.replace(/\*/g, ".*") + "$";
  return new RegExp(regexStr).test(name);
}

/**
 * Parses a namespaced tool name (`serverName__toolName`) and returns the
 * server name if it matches a known server definition.
 */
export function resolveServerForTool(
  toolName: string,
  servers: McpServerDefinition[]
): string | undefined {
  const separatorIndex = toolName.indexOf("__");
  if (separatorIndex === -1) return undefined;

  const serverName = toolName.slice(0, separatorIndex);
  const found = servers.find((s) => s.name === serverName);
  return found ? serverName : undefined;
}

// ── Transport factory ──────────────────────────────────────────────

function createTransport(
  server: McpServerDefinition
): StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport {
  switch (server.transport) {
    case "stdio": {
      if (!server.command) {
        throw new Error(
          `Server "${server.name}": stdio transport requires a "command" field`
        );
      }
      return new StdioClientTransport({
        command: server.command,
        args: server.args,
        env: server.env,
        stderr: "pipe",
      });
    }

    case "sse": {
      if (!server.url) {
        throw new Error(
          `Server "${server.name}": sse transport requires a "url" field`
        );
      }
      return new SSEClientTransport(new URL(server.url));
    }

    case "http": {
      if (!server.url) {
        throw new Error(
          `Server "${server.name}": http transport requires a "url" field`
        );
      }
      return new StreamableHTTPClientTransport(new URL(server.url));
    }

    default:
      throw new Error(
        `Server "${server.name}": unsupported transport "${server.transport}"`
      );
  }
}

// ── Tool filtering ───────────────────────────────────────────────

/** Check if a tool name passes the server's allowed/blocked glob filters. */
function isToolPermitted(toolName: string, definition: McpServerDefinition): boolean {
  const { allowedTools, blockedTools } = definition;

  if (allowedTools?.length) {
    const allowed = allowedTools.some((pattern) => matchesGlob(pattern, toolName));
    if (!allowed) return false;
  }

  if (blockedTools?.length) {
    const blocked = blockedTools.some((pattern) => matchesGlob(pattern, toolName));
    if (blocked) return false;
  }

  return true;
}

// ── McpClientManager ───────────────────────────────────────────────

interface ConnectedServer {
  client: Client;
  definition: McpServerDefinition;
}

export class McpClientManager {
  private servers: Map<string, ConnectedServer> = new Map();
  private toolCache: ExecutableTool[] | null = null;

  /**
   * Connect to one or more MCP servers. Servers with status "inactive"
   * are silently skipped. Connection failures log a warning and skip
   * that server rather than aborting the whole batch.
   */
  async connect(servers: McpServerDefinition[]): Promise<void> {
    const activeServers = servers.filter((s) => s.status !== "inactive");

    const results = await Promise.allSettled(
      activeServers.map(async (serverDef) => {
        const client = new Client(
          { name: `agent-os-${serverDef.name}`, version: "1.0.0" },
          { capabilities: {} }
        );

        const transport = createTransport(serverDef);
        await client.connect(transport);

        this.servers.set(serverDef.name, { client, definition: serverDef });
      })
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "rejected") {
        console.warn(
          `[McpClientManager] Failed to connect to server "${activeServers[i].name}":`,
          result.reason instanceof Error
            ? result.reason.message
            : result.reason
        );
      }
    }

    this.toolCache = null;
  }

  /**
   * Enumerate all tools from every connected server, applying each
   * server's allowedTools / blockedTools glob filters.
   */
  async listTools(): Promise<ExecutableTool[]> {
    if (this.toolCache) return this.toolCache;

    const allTools: ExecutableTool[] = [];

    for (const [serverName, { client, definition }] of this.servers) {
      try {
        const response = await client.listTools();
        const tools = response.tools ?? [];

        for (const tool of tools) {
          if (!isToolPermitted(tool.name, definition)) continue;

          allTools.push({
            name: tool.name,
            description: tool.description ?? "",
            inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>,
            serverName,
          });
        }
      } catch (err) {
        console.warn(
          `[McpClientManager] Failed to list tools for server "${serverName}":`,
          err instanceof Error ? err.message : err
        );
      }
    }

    this.toolCache = allTools;
    return allTools;
  }

  /**
   * Convert all available tools to Anthropic API tool format.
   * Tool names are namespaced as `${serverName}__${toolName}` to
   * prevent collisions across servers.
   */
  async toAnthropicTools(): Promise<AnthropicTool[]> {
    const tools = await this.listTools();

    return tools.map((tool) => ({
      name: `${tool.serverName}__${tool.name}`,
      description: tool.description,
      input_schema: {
        type: "object" as const,
        properties: (tool.inputSchema.properties as Record<string, unknown>) ?? {},
        required: (tool.inputSchema.required as string[]) ?? [],
      },
    }));
  }

  /**
   * Execute a tool call against the appropriate server. Enforces
   * timeout (sandbox.maxExecutionMs) and output size truncation
   * (sandbox.maxOutputSize).
   */
  async executeTool(call: ToolCall): Promise<ToolResult> {
    const startTime = Date.now();

    // Resolve server: explicit serverName, or parse from namespaced tool name
    let serverName = call.serverName;
    let toolName = call.name;

    if (!serverName) {
      const separatorIndex = call.name.indexOf("__");
      if (separatorIndex !== -1) {
        serverName = call.name.slice(0, separatorIndex);
        toolName = call.name.slice(separatorIndex + 2);
      }
    }

    if (!serverName) {
      return {
        toolCallId: call.id,
        output: `Error: cannot determine server for tool "${call.name}". Use namespaced format "serverName__toolName" or provide serverName.`,
        isError: true,
        durationMs: Date.now() - startTime,
      };
    }

    const entry = this.servers.get(serverName);
    if (!entry) {
      return {
        toolCallId: call.id,
        output: `Error: server "${serverName}" is not connected.`,
        isError: true,
        durationMs: Date.now() - startTime,
      };
    }

    const sandbox = entry.definition.sandbox ?? {};
    const timeoutMs = sandbox.maxExecutionMs ?? DEFAULT_MAX_EXECUTION_MS;
    const maxOutputSize = sandbox.maxOutputSize ?? DEFAULT_MAX_OUTPUT_SIZE;

    try {
      const result = await callToolWithTimeout(
        entry.client,
        toolName,
        call.input,
        timeoutMs
      );

      // Extract text content from the result
      const contentItems = result.content as Array<{ type: string; text?: string }>;
      let output = contentItems
        .filter((item) => item.type === "text" && item.text)
        .map((item) => item.text!)
        .join("\n");

      if (output.length > maxOutputSize) {
        output =
          output.slice(0, maxOutputSize) +
          `\n... [truncated, exceeded ${maxOutputSize} byte limit]`;
      }

      return {
        toolCallId: call.id,
        output,
        isError: result.isError === true,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error during tool execution";
      return {
        toolCallId: call.id,
        output: `Error: ${message}`,
        isError: true,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Close all client connections. Call this in a finally block to
   * ensure server processes (especially stdio) are cleaned up.
   */
  async disconnect(): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this.servers.entries()).map(async ([name, { client }]) => {
        try {
          await client.close();
        } catch (err) {
          console.warn(
            `[McpClientManager] Error closing server "${name}":`,
            err instanceof Error ? err.message : err
          );
        }
      })
    );

    // Log any unexpected settlement failures (should not occur since
    // the inner try/catch handles all errors, but guard defensively)
    for (const result of results) {
      if (result.status === "rejected") {
        console.warn(
          "[McpClientManager] Unexpected error during disconnect:",
          result.reason
        );
      }
    }

    this.servers.clear();
    this.toolCache = null;
  }

  /** Returns the number of currently connected servers. */
  get connectedCount(): number {
    return this.servers.size;
  }

  /** Check if a specific server is connected. */
  isConnected(serverName: string): boolean {
    return this.servers.has(serverName);
  }
}

// ── Timeout-aware tool call ──────────────────────────────────────────

/**
 * Call a tool on an MCP client with a timeout. Uses AbortController to
 * signal the client, with a Promise.race fallback to ensure we never
 * wait longer than `timeoutMs`.
 */
async function callToolWithTimeout(
  client: Client,
  toolName: string,
  input: Record<string, unknown>,
  timeoutMs: number
): Promise<Awaited<ReturnType<Client["callTool"]>>> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  const callPromise = client.callTool(
    { name: toolName, arguments: input },
    undefined,
    { signal: abortController.signal }
  );

  const timeoutPromise = new Promise<never>((_, reject) => {
    abortController.signal.addEventListener("abort", () => {
      reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
    });
  });

  try {
    return await Promise.race([callPromise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}
