import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { AgentConfig } from "@/lib/types";
import { generateSubagentDefinition } from "@/lib/claude-code/generate-agents";

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

    let config: AgentConfig = {};
    try {
      config = JSON.parse(agent.config);
    } catch {
      // Invalid JSON — use empty config
    }

    const { path, name, content } = generateSubagentDefinition({
      name: agent.name,
      slug: agent.slug,
      description: agent.description,
      config,
      lettaAgentId: agent.lettaAgentId,
    });

    return NextResponse.json({ path, name, content });
  } catch (error) {
    console.error("[claude-code-agent] Error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to generate agent definition" }, { status: 500 });
  }
}
