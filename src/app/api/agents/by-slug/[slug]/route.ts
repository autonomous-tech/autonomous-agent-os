import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

    let config = {};
    try {
      config = JSON.parse(agent.config);
    } catch {
      // Malformed config column
    }

    return NextResponse.json({
      id: agent.id,
      name: agent.name,
      slug: agent.slug,
      description: agent.description,
      config,
      lettaAgentId: agent.lettaAgentId,
      status: agent.status,
    });
  } catch (error) {
    console.error("[by-slug] Error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to resolve agent" }, { status: 500 });
  }
}
