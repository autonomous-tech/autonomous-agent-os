import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/agents/[id] -- get full agent with parsed JSON fields
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

    return NextResponse.json({
      id: agent.id,
      name: agent.name,
      slug: agent.slug,
      description: agent.description,
      status: agent.status,
      config: JSON.parse(agent.config),
      stages: JSON.parse(agent.stages),
      conversations: JSON.parse(agent.conversations),
      templateId: agent.templateId,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      exportedAt: agent.exportedAt,
    });
  } catch (error) {
    console.error("Failed to get agent:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to get agent" },
      { status: 500 }
    );
  }
}

// PATCH /api/agents/[id] -- partial update
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const agent = await prisma.agentProject.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Build update data -- only allow safe fields
    const ALLOWED_FIELDS = ["name", "description", "config", "stages", "conversations"] as const;
    const VALID_STATUSES = ["draft", "building", "exported", "deployed"];
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.length > 200) {
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
    if (body.config !== undefined) {
      if (typeof body.config !== "object" || body.config === null || Array.isArray(body.config)) {
        return NextResponse.json({ error: "Invalid config" }, { status: 400 });
      }
      // Merge with existing config
      const existingConfig = JSON.parse(agent.config);
      const mergedConfig = { ...existingConfig, ...body.config };
      updateData.config = JSON.stringify(mergedConfig);
    }
    if (body.stages !== undefined) {
      if (typeof body.stages !== "object" || body.stages === null || Array.isArray(body.stages)) {
        return NextResponse.json({ error: "Invalid stages" }, { status: 400 });
      }
      updateData.stages = JSON.stringify(body.stages);
    }
    if (body.conversations !== undefined) {
      if (typeof body.conversations !== "object" || body.conversations === null || Array.isArray(body.conversations)) {
        return NextResponse.json({ error: "Invalid conversations" }, { status: 400 });
      }
      updateData.conversations = JSON.stringify(body.conversations);
    }

    // Reject fields not in allowlist (slug, exportedAt, etc. are server-managed)
    const bodyKeys = Object.keys(body);
    const allowed = new Set<string>([...ALLOWED_FIELDS, "status"]);
    const rejected = bodyKeys.filter((k) => !allowed.has(k));
    if (rejected.length > 0) {
      return NextResponse.json(
        { error: `Fields not allowed: ${rejected.join(", ")}` },
        { status: 400 }
      );
    }

    const updated = await prisma.agentProject.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      status: updated.status,
      config: JSON.parse(updated.config),
      stages: JSON.parse(updated.stages),
      conversations: JSON.parse(updated.conversations),
      templateId: updated.templateId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      exportedAt: updated.exportedAt,
    });
  } catch (error) {
    console.error("Failed to update agent:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await prisma.agentProject.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    await prisma.agentProject.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete agent:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}
