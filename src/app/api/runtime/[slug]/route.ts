import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { AgentConfig } from "@/lib/types";

// GET /api/runtime/[slug] — Public agent info for initial page load
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const agent = await prisma.agentProject.findUnique({
      where: { slug },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Find active deployment
    const deployment = await prisma.deployment.findFirst({
      where: { agentId: agent.id, status: "active" },
    });

    if (!deployment) {
      return NextResponse.json({ error: "Agent is not currently deployed" }, { status: 404 });
    }

    const config: AgentConfig = JSON.parse(deployment.config);

    // Return only public info — no sensitive config exposed
    return NextResponse.json({
      agent: {
        name: config.identity?.name || agent.name,
        emoji: config.identity?.emoji,
        greeting: config.identity?.greeting || `Hi! I'm ${config.identity?.name || agent.name}. How can I help?`,
        description: config.mission?.description || agent.description,
        vibe: config.identity?.vibe,
        tone: config.identity?.tone,
      },
      maxTurns: config.guardrails?.resource_limits?.max_turns_per_session ?? 50,
    });
  } catch (error) {
    console.error("Runtime info error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Failed to load agent" }, { status: 500 });
  }
}
