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
    console.error("Failed to get agent:", error);
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

    // Build update data -- serialize JSON fields back to strings
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.config !== undefined) {
      // Merge with existing config
      const existingConfig = JSON.parse(agent.config);
      const mergedConfig = { ...existingConfig, ...body.config };
      updateData.config = JSON.stringify(mergedConfig);
    }
    if (body.stages !== undefined) {
      updateData.stages = JSON.stringify(body.stages);
    }
    if (body.conversations !== undefined) {
      updateData.conversations = JSON.stringify(body.conversations);
    }
    if (body.exportedAt !== undefined) {
      updateData.exportedAt = body.exportedAt;
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
    console.error("Failed to update agent:", error);
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
    console.error("Failed to delete agent:", error);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}
