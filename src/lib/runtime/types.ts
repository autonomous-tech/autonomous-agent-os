import type { ToolUseRecord } from "./tools.types";

// Runtime message stored in ChatSession.messages JSON array
export interface RuntimeMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string; // ISO 8601
  metadata?: Record<string, unknown>;
  toolUses?: ToolUseRecord[];
}

// Result of a pre-message guardrail check
export interface GuardrailCheckResult {
  allowed: boolean;
  reason?: string;
  action?: "block" | "end_session" | "escalate";
}

// Result of a post-message guardrail check
export interface PostMessageCheckResult {
  failedAttempts: number;
  shouldEscalate: boolean;
}

// Session updates returned by the runtime engine
export interface SessionUpdates {
  turnCount: number;
  failedAttempts: number;
  status: "active" | "ended" | "escalated";
}

// What processMessage returns
export interface ProcessMessageResult {
  response: RuntimeMessage;
  sessionUpdates: SessionUpdates;
  guardrailNotice?: string;
  toolExecutions?: ToolUseRecord[];
}
