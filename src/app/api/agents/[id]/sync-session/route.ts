import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handleSyncSession } from "@/lib/sync-session";

// POST /api/agents/[id]/sync-session — Receive session summary for memory extraction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = await prisma.agentProject.findUnique({ where: { id } });
    const body = await request.json();
    return handleSyncSession(agent, body);
  } catch (error) {
    console.error(
      "Failed to sync session:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return new Response(
      JSON.stringify({ error: "Failed to sync session memory" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
