import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/teams/[id]/members -- list team members with agent details
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

    const members = await prisma.teamMembership.findMany({
      where: { teamId: id },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      members.map((m) => ({
        id: m.id,
        agentId: m.agentId,
        agentName: m.agent.name,
        agentSlug: m.agent.slug,
        agentDescription: m.agent.description,
        agentStatus: m.agent.status,
        role: m.role,
        lettaAgentId: m.lettaAgentId,
        createdAt: m.createdAt,
      }))
    );
  } catch (error) {
    console.error("Failed to list team members:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to list team members" },
      { status: 500 }
    );
  }
}

// POST /api/teams/[id]/members -- add a member to the team
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { agentId, role } = body;

    // Validate team exists
    const team = await prisma.agentTeam.findUnique({ where: { id } });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Validate agentId
    if (!agentId || typeof agentId !== "string") {
      return NextResponse.json(
        { error: "agentId is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate agent exists
    const agent = await prisma.agentProject.findUnique({
      where: { id: agentId },
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Validate role if provided
    const VALID_ROLES = ["orchestrator", "member"];
    const memberRole = role || "member";
    if (!VALID_ROLES.includes(memberRole)) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'orchestrator' or 'member'" },
        { status: 400 }
      );
    }

    // Check if membership already exists
    const existingMembership = await prisma.teamMembership.findUnique({
      where: {
        teamId_agentId: {
          teamId: id,
          agentId,
        },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: "Agent is already a member of this team" },
        { status: 400 }
      );
    }

    // Create membership
    const membership = await prisma.teamMembership.create({
      data: {
        teamId: id,
        agentId,
        role: memberRole,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        id: membership.id,
        agentId: membership.agentId,
        agentName: membership.agent.name,
        agentSlug: membership.agent.slug,
        agentDescription: membership.agent.description,
        agentStatus: membership.agent.status,
        role: membership.role,
        lettaAgentId: membership.lettaAgentId,
        createdAt: membership.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to add team member:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to add team member" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[id]/members -- remove a member from the team
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { agentId } = body;

    // Validate team exists
    const team = await prisma.agentTeam.findUnique({ where: { id } });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Validate agentId
    if (!agentId || typeof agentId !== "string") {
      return NextResponse.json(
        { error: "agentId is required and must be a string" },
        { status: 400 }
      );
    }

    // Find membership
    const membership = await prisma.teamMembership.findUnique({
      where: {
        teamId_agentId: {
          teamId: id,
          agentId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Agent is not a member of this team" },
        { status: 404 }
      );
    }

    // Delete membership
    await prisma.teamMembership.delete({
      where: { id: membership.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove team member:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to remove team member" },
      { status: 500 }
    );
  }
}
