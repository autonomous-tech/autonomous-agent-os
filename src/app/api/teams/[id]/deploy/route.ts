import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { lettaClient, isLettaEnabled } from "@/lib/letta/client";
import { attachSharedBlocks } from "@/lib/letta/memory";
import { translateToLettaParams, buildMemoryCategorizationPrompt } from "@/lib/letta/translate";
import type { AgentConfig } from "@/lib/types";
import type { SharedBlockIds } from "@/lib/letta/memory";

/**
 * Deploy a single agent to Letta. Returns the lettaAgentId or null.
 * Simplified version of the agent deploy logic — just creates the Letta agent.
 */
async function deployAgentToLetta(
  agentName: string,
  config: AgentConfig
): Promise<string | null> {
  if (!isLettaEnabled() || !lettaClient) return null;

  try {
    const params = translateToLettaParams(agentName, config);

    // Append memory categorization instructions to system prompt
    const systemWithMemory = params.system + "\n\n" + buildMemoryCategorizationPrompt();

    const lettaAgent = await lettaClient.agents.create({
      name: params.name,
      description: params.description,
      system: systemWithMemory,
      model: params.model,
      embedding: params.embedding,
      memory_blocks: params.memoryBlocks.map((b) => ({
        label: b.label,
        value: b.value,
        limit: b.limit ?? 5000,
      })),
    });

    return lettaAgent.id;
  } catch (error) {
    console.error(
      `[team-deploy] Failed to deploy agent ${agentName} to Letta:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

// POST /api/teams/[id]/deploy -- deploy all team agents to Letta
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if Letta is enabled
    if (!isLettaEnabled()) {
      return NextResponse.json(
        { error: "Letta is not enabled. Set LETTA_BASE_URL in .env" },
        { status: 400 }
      );
    }

    // Get team with members and active project
    const team = await prisma.agentTeam.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            agent: true,
          },
        },
        projects: {
          where: { status: "active" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const results: Array<{
      agentId: string;
      agentName: string;
      lettaAgentId: string | null;
      status: "deployed" | "failed" | "skipped";
      error?: string;
    }> = [];

    // Deploy each team member that doesn't have a lettaAgentId yet
    for (const member of team.members) {
      // Skip if already deployed
      if (member.lettaAgentId) {
        results.push({
          agentId: member.agentId,
          agentName: member.agent.name,
          lettaAgentId: member.lettaAgentId,
          status: "skipped",
        });
        continue;
      }

      const config: AgentConfig = JSON.parse(member.agent.config);

      // Deploy to Letta
      const lettaAgentId = await deployAgentToLetta(member.agent.name, config);

      if (lettaAgentId) {
        // Update membership with lettaAgentId
        await prisma.teamMembership.update({
          where: { id: member.id },
          data: { lettaAgentId },
        });

        // Also update the agent project if it doesn't have a lettaAgentId
        if (!member.agent.lettaAgentId) {
          await prisma.agentProject.update({
            where: { id: member.agentId },
            data: { lettaAgentId },
          });
        }

        results.push({
          agentId: member.agentId,
          agentName: member.agent.name,
          lettaAgentId,
          status: "deployed",
        });
      } else {
        results.push({
          agentId: member.agentId,
          agentName: member.agent.name,
          lettaAgentId: null,
          status: "failed",
          error: "Failed to create Letta agent",
        });
      }
    }

    // If there's an active project with shared blocks, attach them to all deployed agents
    let blocksAttached = 0;
    if (team.projects.length > 0) {
      const activeProject = team.projects[0];
      const blockIds = JSON.parse(activeProject.lettaBlockIds) as SharedBlockIds | Record<string, never>;

      // Check if we have all block IDs (project, decisions, taskBoard, brand)
      const hasAllBlocks =
        blockIds &&
        typeof blockIds === "object" &&
        "project" in blockIds &&
        "decisions" in blockIds &&
        "taskBoard" in blockIds &&
        "brand" in blockIds;

      if (hasAllBlocks) {
        for (const result of results) {
          if (result.lettaAgentId && result.status === "deployed") {
            try {
              await attachSharedBlocks(result.lettaAgentId, blockIds as SharedBlockIds);
              blocksAttached++;
            } catch (attachError) {
              console.error(
                `[team-deploy] Failed to attach shared blocks to agent ${result.agentName}:`,
                attachError instanceof Error ? attachError.message : attachError
              );
              result.error = "Failed to attach shared project blocks";
            }
          }
        }
      }
    }

    // Update team status to active
    await prisma.agentTeam.update({
      where: { id },
      data: { status: "active" },
    });

    return NextResponse.json({
      teamId: id,
      teamName: team.name,
      deployedCount: results.filter((r) => r.status === "deployed").length,
      skippedCount: results.filter((r) => r.status === "skipped").length,
      failedCount: results.filter((r) => r.status === "failed").length,
      blocksAttached,
      results,
    });
  } catch (error) {
    console.error("Team deploy error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to deploy team" },
      { status: 500 }
    );
  }
}
