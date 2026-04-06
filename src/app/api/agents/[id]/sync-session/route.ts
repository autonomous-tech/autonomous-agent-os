import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isLettaEnabled } from "@/lib/letta/client";
import { syncSessionMemory } from "@/lib/letta/memory-extract";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await prisma.agentProject.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (!agent.lettaAgentId) {
      return NextResponse.json(
        { error: "Agent has no Letta deployment — deploy first" },
        { status: 400 }
      );
    }

    if (!isLettaEnabled()) {
      return NextResponse.json(
        { error: "Letta is not configured on this server" },
        { status: 503 }
      );
    }

    const body = await request.json();

    if (!body.summary || typeof body.summary !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid summary field" },
        { status: 400 }
      );
    }

    const MAX_SUMMARY_LENGTH = 50_000;
    const MAX_ARRAY_ITEMS = 50;
    const MAX_ITEM_LENGTH = 2_000;

    if (body.summary.length > MAX_SUMMARY_LENGTH) {
      return NextResponse.json(
        { error: `Summary exceeds ${MAX_SUMMARY_LENGTH} character limit` },
        { status: 400 }
      );
    }

    function sanitizeStringArray(arr: unknown, maxItems: number, maxLen: number): string[] {
      if (!Array.isArray(arr)) return [];
      return arr
        .filter((item): item is string => typeof item === "string")
        .slice(0, maxItems)
        .map((s) => s.slice(0, maxLen));
    }

    const persisted = await syncSessionMemory(agent.lettaAgentId, {
      summary: body.summary,
      decisions: sanitizeStringArray(body.decisions, MAX_ARRAY_ITEMS, MAX_ITEM_LENGTH),
      preferences: sanitizeStringArray(body.preferences, MAX_ARRAY_ITEMS, MAX_ITEM_LENGTH),
      knowledge: sanitizeStringArray(body.knowledge, MAX_ARRAY_ITEMS, MAX_ITEM_LENGTH),
      taskUpdates: sanitizeStringArray(body.taskUpdates, MAX_ARRAY_ITEMS, MAX_ITEM_LENGTH),
    });

    return NextResponse.json({ persisted });
  } catch (error) {
    console.error("[sync-session] Error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to sync session" }, { status: 500 });
  }
}
