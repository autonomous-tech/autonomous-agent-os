import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { lettaClient, isLettaEnabled } from "@/lib/letta/client";
import { createSharedProjectBlocks, attachSharedBlocks } from "@/lib/letta/memory";
import type { SharedBlockIds } from "@/lib/letta/memory";

// GET /api/teams/[id]/projects -- list team projects
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const team = await prisma.agentTeam.findUnique({ where: { id } });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const projects = await prisma.teamProject.findMany({
      where: { teamId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      projects.map((p) => ({
        id: p.id,
        teamId: p.teamId,
        name: p.name,
        brief: p.brief,
        status: p.status,
        lettaBlockIds: JSON.parse(p.lettaBlockIds),
        activityLog: JSON.parse(p.activityLog),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }))
    );
  } catch (error) {
    console.error("Failed to list team projects:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to list team projects" },
      { status: 500 }
    );
  }
}

// POST /api/teams/[id]/projects -- create a new team project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, brief } = body;

    // Validate team exists
    const team = await prisma.agentTeam.findUnique({
      where: { id },
      include: {
        members: {
          select: {
            lettaAgentId: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Validate name
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required and must be a string" },
        { status: 400 }
      );
    }

    if (name.length > 200) {
      return NextResponse.json(
        { error: "Name must be 200 characters or less" },
        { status: 400 }
      );
    }

    // Validate brief if provided
    if (brief !== undefined && typeof brief !== "string") {
      return NextResponse.json(
        { error: "Brief must be a string" },
        { status: 400 }
      );
    }

    let lettaBlockIds: SharedBlockIds | Record<string, never> = {};

    // If Letta is enabled, create shared project blocks
    if (isLettaEnabled() && lettaClient) {
      try {
        lettaBlockIds = await createSharedProjectBlocks(
          name,
          brief || ""
        );

        // Attach blocks to all team members that have Letta agents
        const memberLettaIds = team.members
          .map((m) => m.lettaAgentId)
          .filter((id): id is string => id !== null);

        await Promise.all(
          memberLettaIds.map((lettaAgentId) =>
            attachSharedBlocks(lettaAgentId, lettaBlockIds as SharedBlockIds)
          )
        );

        console.log(
          `[team-project] Created shared blocks and attached to ${memberLettaIds.length} team members`
        );
      } catch (lettaError) {
        // Log error but don't fail the request — project still gets created
        console.error(
          "[team-project] Failed to create Letta shared blocks:",
          lettaError instanceof Error ? lettaError.message : lettaError
        );
        lettaBlockIds = {};
      }
    }

    // Create project
    const project = await prisma.teamProject.create({
      data: {
        teamId: id,
        name,
        brief: brief || "",
        lettaBlockIds: JSON.stringify(lettaBlockIds),
        activityLog: JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            type: "created",
            message: "Project created",
          },
        ]),
      },
    });

    return NextResponse.json(
      {
        id: project.id,
        teamId: project.teamId,
        name: project.name,
        brief: project.brief,
        status: project.status,
        lettaBlockIds: JSON.parse(project.lettaBlockIds),
        activityLog: JSON.parse(project.activityLog),
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create team project:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to create team project" },
      { status: 500 }
    );
  }
}
