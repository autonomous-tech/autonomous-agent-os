import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateClaudeCodeFiles } from "@/lib/claude-code/generate-agent";

// GET /api/agents/[id]/claude-code-export — Generate Claude Code export files
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = await prisma.agentProject.findUnique({ where: { id } });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const agentOsUrl = new URL(request.url).searchParams.get("url") || "http://localhost:3000";

    const config = JSON.parse(agent.config);
    const files = generateClaudeCodeFiles({
      slug: agent.slug,
      config,
      lettaAgentId: agent.lettaAgentId,
      agentOsUrl,
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error(
      "Failed to generate Claude Code export:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Failed to generate export" },
      { status: 500 }
    );
  }
}
