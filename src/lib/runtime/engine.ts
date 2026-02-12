import { chat } from "@/lib/claude";
import type { AgentConfig } from "@/lib/types";
import type { RuntimeMessage, ProcessMessageResult } from "./types";
import { checkPreMessage } from "./guardrails";

/**
 * Process a user message against a deployed agent.
 * Returns the assistant response and any session updates.
 */
export async function processMessage(
  systemPrompt: string,
  config: AgentConfig,
  sessionStatus: string,
  turnCount: number,
  failedAttempts: number,
  history: RuntimeMessage[],
  userMessage: string
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

  // 2. Build Claude messages from history (cap at 40 messages = 20 turns)
  const cappedHistory = history.slice(-40);
  const claudeMessages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...cappedHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  // 3. Call Claude with optional maxTokens from guardrails
  const maxResponseLength = guardrails?.resource_limits?.max_response_length;
  const maxTokens = maxResponseLength ? Math.min(maxResponseLength, 4096) : undefined;

  const responseText = await chat(systemPrompt, claudeMessages, maxTokens ? { maxTokens } : undefined);

  // 4. Build response message
  const response: RuntimeMessage = {
    id: generateId(),
    role: "assistant",
    content: responseText,
    timestamp: new Date().toISOString(),
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
  };
}

function generateId(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
