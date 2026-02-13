import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/teams/[id] -- get team by ID with members and projects
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const team = await prisma.agentTeam.findUnique({
      where: { id },
      include: {
        members: {
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
        },
        projects: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: team.id,
      name: team.name,
      slug: team.slug,
      description: team.description,
      status: team.status,
      orchestrationConfig: JSON.parse(team.orchestrationConfig),
      members: team.members.map((m) => ({
        id: m.id,
        agentId: m.agentId,
        agentName: m.agent.name,
        agentSlug: m.agent.slug,
        agentDescription: m.agent.description,
        agentStatus: m.agent.status,
        role: m.role,
        lettaAgentId: m.lettaAgentId,
        createdAt: m.createdAt,
      })),
      projects: team.projects.map((p) => ({
        id: p.id,
        name: p.name,
        brief: p.brief,
        status: p.status,
        lettaBlockIds: JSON.parse(p.lettaBlockIds),
        activityLog: JSON.parse(p.activityLog),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    });
  } catch (error) {
    console.error("Failed to get team:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to get team" },
      { status: 500 }
    );
  }
}

// PATCH /api/teams/[id] -- update team
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const team = await prisma.agentTeam.findUnique({ where: { id } });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Build update data -- only allow safe fields
    const ALLOWED_FIELDS = ["name", "description", "orchestrationConfig", "status"] as const;
    const VALID_STATUSES = ["draft", "active", "archived"];
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.length > 100) {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      }
      updateData.name = body.name;
    }

    if (body.description !== undefined) {
      if (typeof body.description !== "string") {
        return NextResponse.json({ error: "Invalid description" }, { status: 400 });
      }
      updateData.description = body.description;
    }

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }
      updateData.status = body.status;
    }

    if (body.orchestrationConfig !== undefined) {
      if (typeof body.orchestrationConfig !== "object" || body.orchestrationConfig === null || Array.isArray(body.orchestrationConfig)) {
        return NextResponse.json({ error: "Invalid orchestrationConfig" }, { status: 400 });
      }
      // Merge with existing config
      const existingConfig = JSON.parse(team.orchestrationConfig);
      const mergedConfig = { ...existingConfig, ...body.orchestrationConfig };
      updateData.orchestrationConfig = JSON.stringify(mergedConfig);
    }

    // Reject fields not in allowlist
    const bodyKeys = Object.keys(body);
    const allowed = new Set<string>(ALLOWED_FIELDS);
    const rejected = bodyKeys.filter((k) => !allowed.has(k));
    if (rejected.length > 0) {
      return NextResponse.json(
        { error: `Fields not allowed: ${rejected.join(", ")}` },
        { status: 400 }
      );
    }

    const updated = await prisma.agentTeam.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      status: updated.status,
      orchestrationConfig: JSON.parse(updated.orchestrationConfig),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("Failed to update team:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to update team" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[id] -- delete team (cascades to memberships and projects)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const team = await prisma.agentTeam.findUnique({ where: { id } });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    await prisma.agentTeam.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete team:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to delete team" },
      { status: 500 }
    );
  }
}
