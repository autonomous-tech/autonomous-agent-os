import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  VALID_TRANSPORTS,
  VALID_STATUSES,
  MAX_NAME_LENGTH,
  ALLOWED_PATCH_FIELDS,
  parseServerRow,
  isValidUrl,
  validateMcpFields,
} from "@/lib/mcp-helpers";

// PATCH /api/agents/[id]/mcp-servers/[serverId] — Update an MCP server config
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; serverId: string }> }
) {
  try {
    const { id, serverId } = await params;

    // Verify agent exists
    const agent = await prisma.agentProject.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Look up server and verify ownership
    const server = await prisma.mcpServerConfig.findUnique({
      where: { id: serverId },
    });
    if (!server || server.agentId !== id) {
      return NextResponse.json(
        { error: "MCP server not found" },
        { status: 404 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Reject unknown fields
    const rejected = Object.keys(body).filter((k) => !ALLOWED_PATCH_FIELDS.has(k));
    if (rejected.length > 0) {
      return NextResponse.json(
        { error: `Fields not allowed: ${rejected.join(", ")}` },
        { status: 400 }
      );
    }

    // ── Validate provided fields ────────────────────────────────────
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (
        typeof body.name !== "string" ||
        body.name.trim().length === 0 ||
        body.name.length > MAX_NAME_LENGTH
      ) {
        return NextResponse.json(
          { error: `name must be a string of 1–${MAX_NAME_LENGTH} characters` },
          { status: 400 }
        );
      }
      // Check for duplicate name (excluding self)
      const duplicate = await prisma.mcpServerConfig.findUnique({
        where: { agentId_name: { agentId: id, name: body.name as string } },
      });
      if (duplicate && duplicate.id !== serverId) {
        return NextResponse.json(
          { error: `An MCP server named "${body.name}" already exists for this agent` },
          { status: 409 }
        );
      }
      updateData.name = (body.name as string).trim();
    }

    if (body.transport !== undefined) {
      if (
        typeof body.transport !== "string" ||
        !VALID_TRANSPORTS.includes(body.transport as (typeof VALID_TRANSPORTS)[number])
      ) {
        return NextResponse.json(
          { error: `transport must be one of: ${VALID_TRANSPORTS.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.transport = body.transport;
    }

    if (body.command !== undefined) {
      if (body.command !== null && typeof body.command !== "string") {
        return NextResponse.json(
          { error: "command must be a string or null" },
          { status: 400 }
        );
      }
      updateData.command = body.command;
    }

    if (body.url !== undefined) {
      if (body.url !== null) {
        if (typeof body.url !== "string" || !isValidUrl(body.url)) {
          return NextResponse.json(
            { error: "url must be a valid http/https URL or null" },
            { status: 400 }
          );
        }
      }
      updateData.url = body.url;
    }

    // Validate collection fields (args, env, allowedTools, blockedTools, sandboxConfig)
    const fieldError = validateMcpFields(body);
    if (fieldError) return fieldError;

    if (body.args !== undefined) updateData.args = JSON.stringify(body.args);
    if (body.env !== undefined) updateData.env = JSON.stringify(body.env);
    if (body.allowedTools !== undefined) updateData.allowedTools = JSON.stringify(body.allowedTools);
    if (body.blockedTools !== undefined) updateData.blockedTools = JSON.stringify(body.blockedTools);
    if (body.sandboxConfig !== undefined) updateData.sandboxConfig = JSON.stringify(body.sandboxConfig);

    if (body.status !== undefined) {
      if (
        typeof body.status !== "string" ||
        !VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])
      ) {
        return NextResponse.json(
          { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.status = body.status;
    }

    // ── Cross-field transport validation ────────────────────────────
    const effectiveTransport =
      (updateData.transport as string) ?? server.transport;
    const effectiveCommand =
      "command" in updateData ? updateData.command : server.command;
    const effectiveUrl = "url" in updateData ? updateData.url : server.url;

    if (effectiveTransport === "stdio") {
      if (!effectiveCommand || typeof effectiveCommand !== "string") {
        return NextResponse.json(
          { error: "command is required for stdio transport" },
          { status: 400 }
        );
      }
    } else {
      if (
        !effectiveUrl ||
        typeof effectiveUrl !== "string" ||
        !isValidUrl(effectiveUrl)
      ) {
        return NextResponse.json(
          { error: "A valid http/https url is required for sse and http transports" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.mcpServerConfig.update({
      where: { id: serverId },
      data: updateData,
    });

    const parsed = parseServerRow(
      updated as unknown as Record<string, unknown>
    );

    return NextResponse.json(parsed);
  } catch (error) {
    console.error(
      "Failed to update MCP server:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Failed to update MCP server" },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id]/mcp-servers/[serverId] — Remove an MCP server
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; serverId: string }> }
) {
  try {
    const { id, serverId } = await params;

    // Verify agent exists
    const agent = await prisma.agentProject.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Look up server and verify ownership
    const server = await prisma.mcpServerConfig.findUnique({
      where: { id: serverId },
    });
    if (!server || server.agentId !== id) {
      return NextResponse.json(
        { error: "MCP server not found" },
        { status: 404 }
      );
    }

    await prisma.mcpServerConfig.delete({ where: { id: serverId } });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error(
      "Failed to delete MCP server:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Failed to delete MCP server" },
      { status: 500 }
    );
  }
}
