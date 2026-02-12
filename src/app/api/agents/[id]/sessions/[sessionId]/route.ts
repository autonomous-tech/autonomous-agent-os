import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/agents/[id]/sessions/[sessionId] — View session detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id, sessionId } = await params;

    // Verify agent exists
    const agent = await prisma.agentProject.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Verify session belongs to this agent's deployment
    const deployment = await prisma.deployment.findUnique({
      where: { id: session.deploymentId },
    });

    if (!deployment || deployment.agentId !== id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: session.id,
      turnCount: session.turnCount,
      failedAttempts: session.failedAttempts,
      status: session.status,
      messages: JSON.parse(session.messages),
      metadata: JSON.parse(session.metadata),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    console.error("Get session error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Failed to get session" }, { status: 500 });
  }
}
