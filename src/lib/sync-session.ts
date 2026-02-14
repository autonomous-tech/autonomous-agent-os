import { NextResponse } from "next/server";
import { isLettaEnabled } from "@/lib/letta/client";
import { syncSessionMemory } from "@/lib/letta/memory-extract";

const MAX_SUMMARY_LENGTH = 10_000;

interface AgentRow {
  lettaAgentId: string | null;
  config: string;
}

/**
 * Shared handler for sync-session routes (by id and by slug).
 * Caller resolves the agent; this handles validation, memory sync, and response.
 */
export async function handleSyncSession(
  agent: AgentRow | null,
  body: unknown
): Promise<NextResponse> {
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (!agent.lettaAgentId) {
    return NextResponse.json(
      { error: "Agent does not have Letta memory enabled" },
      { status: 400 }
    );
  }

  if (!isLettaEnabled()) {
    return NextResponse.json(
      { error: "Letta is not configured" },
      { status: 503 }
    );
  }

  const parsed = body as Record<string, unknown>;
  if (!parsed.summary || typeof parsed.summary !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid summary" },
      { status: 400 }
    );
  }

  const summary = parsed.summary.slice(0, MAX_SUMMARY_LENGTH);
  const config = JSON.parse(agent.config);
  const learnings = await syncSessionMemory(
    agent.lettaAgentId,
    summary,
    config
  );

  return NextResponse.json({
    success: true,
    learnings: {
      persona: learnings.persona.length,
      decisions: learnings.decisions.length,
      archival: learnings.archival.length,
    },
  });
}
