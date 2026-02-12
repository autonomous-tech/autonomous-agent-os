import type { GuardrailsConfig } from "@/lib/types";
import type { GuardrailCheckResult, PostMessageCheckResult } from "./types";

/**
 * Pre-message guardrail check: validates whether the session is in a state
 * that allows a new message to be processed.
 */
export function checkPreMessage(
  guardrails: GuardrailsConfig | undefined,
  turnCount: number,
  sessionStatus: string
): GuardrailCheckResult {
  if (sessionStatus === "ended") {
    return { allowed: false, reason: "Session has ended", action: "block" };
  }

  if (sessionStatus === "escalated") {
    return {
      allowed: false,
      reason: "Session has been escalated to a human",
      action: "block",
    };
  }

  const maxTurns = guardrails?.resource_limits?.max_turns_per_session ?? 50;
  if (turnCount >= maxTurns) {
    return {
      allowed: false,
      reason: `Maximum turns reached (${maxTurns})`,
      action: "end_session",
    };
  }

  return { allowed: true };
}

/**
 * Post-message guardrail check: determines whether the session should be
 * escalated based on the number of consecutive failed attempts.
 */
export function checkPostMessage(
  guardrails: GuardrailsConfig | undefined,
  failedAttempts: number
): PostMessageCheckResult {
  const threshold = guardrails?.resource_limits?.escalation_threshold ?? 3;
  return {
    failedAttempts,
    shouldEscalate: failedAttempts >= threshold,
  };
}
