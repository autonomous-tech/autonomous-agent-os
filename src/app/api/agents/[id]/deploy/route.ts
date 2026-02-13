import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { AgentConfig, StageData } from "@/lib/types";
import { validateAgent } from "@/lib/validate";
import { buildRuntimeSystemPrompt } from "@/lib/runtime/prompt";
import { rowToDefinition } from "@/lib/mcp-helpers";
import { lettaClient, isLettaEnabled } from "@/lib/letta/client";
import { translateToLettaParams } from "@/lib/letta/translate";
import { loadSkillsDirectory } from "@/lib/letta/skills";
import path from "path";
import fs from "fs/promises";

// POST /api/agents/[id]/deploy — Deploy an agent
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await prisma.agentProject.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const config: AgentConfig = JSON.parse(agent.config);
    const stages: StageData = JSON.parse(agent.stages);

    // Validate config — structural errors block deployment
    const validation = validateAgent(config, stages);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", errors: validation.errors, warnings: validation.warnings },
        { status: 400 }
      );
    }

    // Retire any existing active deployment
    const existingDeployments = await prisma.deployment.findMany({
      where: { agentId: id, status: "active" },
    });

    for (const dep of existingDeployments) {
      await prisma.deployment.update({
        where: { id: dep.id },
        data: { status: "retired" },
      });
    }

    // Calculate version number
    const lastDeployment = await prisma.deployment.findFirst({
      where: { agentId: id },
      orderBy: { version: "desc" },
    });
    const version = (lastDeployment?.version ?? 0) + 1;

    // Build runtime system prompt
    const systemPrompt = buildRuntimeSystemPrompt(config);

    // Snapshot active MCP server configs for this agent
    const activeMcpServers = await prisma.mcpServerConfig.findMany({
      where: { agentId: id, status: "active" },
    });
    const mcpConfig = JSON.stringify(activeMcpServers.map(rowToDefinition));

    // Create deployment
    const deployment = await prisma.deployment.create({
      data: {
        agentId: id,
        version,
        config: agent.config,
        systemPrompt,
        mcpConfig,
        status: "active",
      },
    });

    // Update agent status to deployed
    await prisma.agentProject.update({
      where: { id },
      data: { status: "deployed" },
    });

    // Side-deploy to Letta if enabled and agent doesn't have a Letta agent yet
    let lettaAgentId: string | null = agent.lettaAgentId;
    if (isLettaEnabled() && lettaClient && !agent.lettaAgentId) {
      try {
        const params = translateToLettaParams(agent.name, config);

        const lettaAgent = await lettaClient.agents.create({
          name: params.name,
          description: params.description,
          system: params.system,
          model: params.model,
          embedding: params.embedding,
          memory_blocks: params.memoryBlocks.map((b) => ({
            label: b.label,
            value: b.value,
            limit: b.limit ?? 5000,
          })),
        });

        lettaAgentId = lettaAgent.id;
        await prisma.agentProject.update({
          where: { id },
          data: { lettaAgentId: lettaAgent.id },
        });

        // Load skills if directory exists
        const skillsDir = path.join(process.cwd(), "skills");
        try {
          await fs.access(skillsDir);
          await loadSkillsDirectory(lettaAgent.id, skillsDir);
        } catch {
          // skills/ directory doesn't exist — skip
        }
      } catch (lettaError) {
        console.error(
          "[deploy] Letta side-deploy failed (non-blocking):",
          lettaError instanceof Error ? lettaError.message : lettaError
        );
      }
    }

    return NextResponse.json({
      deployment: {
        id: deployment.id,
        version: deployment.version,
        status: deployment.status,
        createdAt: deployment.createdAt,
      },
      publicUrl: `/a/${agent.slug}`,
      ...(lettaAgentId ? { lettaAgentId } : {}),
    });
  } catch (error) {
    console.error("Deploy error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Failed to deploy agent" }, { status: 500 });
  }
}

// GET /api/agents/[id]/deploy — Get deployment status
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

    const deployment = await prisma.deployment.findFirst({
      where: { agentId: id, status: { in: ["active", "paused"] } },
      orderBy: { createdAt: "desc" },
    });

    if (!deployment) {
      return NextResponse.json({ deployment: null });
    }

    return NextResponse.json({
      deployment: {
        id: deployment.id,
        version: deployment.version,
        status: deployment.status,
        createdAt: deployment.createdAt,
      },
      publicUrl: `/a/${agent.slug}`,
    });
  } catch (error) {
    console.error("Get deployment error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Failed to get deployment status" }, { status: 500 });
  }
}

// DELETE /api/agents/[id]/deploy — Pause deployment
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const deployment = await prisma.deployment.findFirst({
      where: { agentId: id, status: "active" },
    });

    if (!deployment) {
      return NextResponse.json({ error: "No active deployment found" }, { status: 404 });
    }

    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: "paused" },
    });

    return NextResponse.json({ status: "paused" });
  } catch (error) {
    console.error("Pause deployment error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Failed to pause deployment" }, { status: 500 });
  }
}

// PATCH /api/agents/[id]/deploy — Resume a paused deployment
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const deployment = await prisma.deployment.findFirst({
      where: { agentId: id, status: "paused" },
    });

    if (!deployment) {
      return NextResponse.json({ error: "No paused deployment found" }, { status: 404 });
    }

    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: "active" },
    });

    return NextResponse.json({ status: "active" });
  } catch (error) {
    console.error("Resume deployment error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Failed to resume deployment" }, { status: 500 });
  }
}
