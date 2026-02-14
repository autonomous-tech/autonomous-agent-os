import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handleSyncSession } from "@/lib/sync-session";

// POST /api/agents/by-slug/[slug]/sync-session — Receive session summary by slug
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const agent = await prisma.agentProject.findUnique({ where: { slug } });
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
