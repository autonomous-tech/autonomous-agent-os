import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { RuntimeMessage } from "@/lib/runtime/types";

// GET /api/agents/[id]/sessions — List sessions for an agent
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await prisma.agentProject.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get all deployments for this agent
    const deployments = await prisma.deployment.findMany({
      where: { agentId: id },
      select: { id: true },
    });

    const deploymentIds = deployments.map((d) => d.id);

    if (deploymentIds.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    const sessions = await prisma.chatSession.findMany({
      where: { deploymentId: { in: deploymentIds } },
      orderBy: { createdAt: "desc" },
    });

    // Return summaries
    const summaries = sessions.map((s) => {
      const messages: RuntimeMessage[] = JSON.parse(s.messages);
      const firstUserMessage = messages.find((m) => m.role === "user");
      return {
        id: s.id,
        turnCount: s.turnCount,
        status: s.status,
        createdAt: s.createdAt,
        firstMessage: firstUserMessage?.content?.slice(0, 100) || null,
      };
    });

    return NextResponse.json({ sessions: summaries });
  } catch (error) {
    console.error("List sessions error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Failed to list sessions" }, { status: 500 });
  }
}
