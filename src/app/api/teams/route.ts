import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateSlug } from "@/lib/slug";

// GET /api/teams -- list all teams
export async function GET() {
  try {
    const teams = await prisma.agentTeam.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
    });

    return NextResponse.json(
      teams.map((team) => ({
        id: team.id,
        name: team.name,
        slug: team.slug,
        description: team.description,
        status: team.status,
        memberCount: team._count.members,
        projectCount: team._count.projects,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      }))
    );
  } catch (error) {
    console.error("Failed to list teams:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to list teams" },
      { status: 500 }
    );
  }
}

// POST /api/teams -- create a new team
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, agentIds } = body;

    // Validate name
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required and must be a string" },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: "Name must be 100 characters or less" },
        { status: 400 }
      );
    }

    // Validate description if provided
    if (description !== undefined && typeof description !== "string") {
      return NextResponse.json(
        { error: "Description must be a string" },
        { status: 400 }
      );
    }

    // Validate agentIds if provided
    if (agentIds !== undefined) {
      if (!Array.isArray(agentIds)) {
        return NextResponse.json(
          { error: "agentIds must be an array" },
          { status: 400 }
        );
      }

      // Verify all agents exist
      if (agentIds.length > 0) {
        const agents = await prisma.agentProject.findMany({
          where: { id: { in: agentIds } },
          select: { id: true },
        });

        if (agents.length !== agentIds.length) {
          return NextResponse.json(
            { error: "One or more agent IDs are invalid" },
            { status: 400 }
          );
        }
      }
    }

    // Generate slug from name with timestamp suffix for uniqueness
    const slug = generateSlug(name) + "-" + Date.now().toString(36);

    // Create team and memberships in a transaction
    const team = await prisma.agentTeam.create({
      data: {
        name,
        slug,
        description: description || "",
        members: agentIds && agentIds.length > 0
          ? {
              create: agentIds.map((agentId: string) => ({
                agentId,
                role: "member",
              })),
            }
          : undefined,
      },
      include: {
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        id: team.id,
        name: team.name,
        slug: team.slug,
        description: team.description,
        status: team.status,
        orchestrationConfig: JSON.parse(team.orchestrationConfig),
        memberCount: team._count.members,
        projectCount: team._count.projects,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create team:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 }
    );
  }
}
