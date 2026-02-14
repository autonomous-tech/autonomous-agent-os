import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/agents/by-slug/[slug] — Lookup agent by slug
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const agent = await prisma.agentProject.findUnique({ where: { slug } });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: agent.id,
      name: agent.name,
      slug: agent.slug,
      description: agent.description,
      status: agent.status,
      config: JSON.parse(agent.config),
      lettaAgentId: agent.lettaAgentId,
    });
  } catch (error) {
    console.error(
      "Failed to get agent by slug:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Failed to get agent" },
      { status: 500 }
    );
  }
}
