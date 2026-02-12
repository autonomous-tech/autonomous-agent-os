// ── MCP Server & Tool Types ──────────────────────────────────────────

export type McpTransport = "stdio" | "sse" | "http";

export interface SandboxConfig {
  maxExecutionMs?: number;    // Default: 30000 (30s)
  allowNetwork?: boolean;     // Default: false
  allowedPaths?: string[];    // Filesystem paths the tool can access
  maxOutputSize?: number;     // Default: 102400 (100KB)
}

export interface McpServerDefinition {
  name: string;
  transport: McpTransport;
  command?: string;           // For stdio transport
  args?: string[];            // For stdio transport
  url?: string;               // For sse/http transport
  env?: Record<string, string>;
  allowedTools?: string[];    // Glob patterns for allowed tool names
  blockedTools?: string[];    // Glob patterns for blocked tool names
  sandbox?: SandboxConfig;
  status?: "active" | "inactive";
}

export interface ExecutableTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverName: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  serverName?: string;
}

export interface ToolResult {
  toolCallId: string;
  output: string;
  isError: boolean;
  durationMs: number;
}

export interface ToolUseRecord {
  toolCallId: string;
  toolName: string;
  serverName: string;
  input: Record<string, unknown>;
  output: string;
  isError: boolean;
  durationMs: number;
}

export interface AgenticLoopConfig {
  maxToolRoundtrips?: number;        // Default: 10
  maxTotalToolExecutionMs?: number;  // Default: 120000 (2 min)
  parallelToolExecution?: boolean;   // Default: true
}

// ── Guardrail limits for tool execution ─────────────────────────────

export interface ToolLimits {
  maxToolCallsPerSession?: number;   // Default: 100
  maxToolCallsPerHour?: number;      // Default: 1000
}
