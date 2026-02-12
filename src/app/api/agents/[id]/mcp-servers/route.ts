import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  VALID_TRANSPORTS,
  MAX_NAME_LENGTH,
  parseServerRow,
  validateMcpFields,
  validateTransportFields,
} from "@/lib/mcp-helpers";

// GET /api/agents/[id]/mcp-servers — List all MCP servers for an agent
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

    const rows = await prisma.mcpServerConfig.findMany({
      where: { agentId: id },
      orderBy: { createdAt: "asc" },
    });

    const servers = rows.map((row) =>
      parseServerRow(row as unknown as Record<string, unknown>)
    );

    return NextResponse.json({ servers });
  } catch (error) {
    console.error(
      "Failed to list MCP servers:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Failed to list MCP servers" },
      { status: 500 }
    );
  }
}

// POST /api/agents/[id]/mcp-servers — Add a new MCP server
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await prisma.agentProject.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
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

    // ── Required: name ──────────────────────────────────────────────
    if (
      typeof body.name !== "string" ||
      body.name.trim().length === 0 ||
      body.name.length > MAX_NAME_LENGTH
    ) {
      return NextResponse.json(
        { error: `name is required and must be a string of 1–${MAX_NAME_LENGTH} characters` },
        { status: 400 }
      );
    }

    // ── Required: transport ─────────────────────────────────────────
    if (
      typeof body.transport !== "string" ||
      !VALID_TRANSPORTS.includes(body.transport as (typeof VALID_TRANSPORTS)[number])
    ) {
      return NextResponse.json(
        { error: `transport is required and must be one of: ${VALID_TRANSPORTS.join(", ")}` },
        { status: 400 }
      );
    }
    const transport = body.transport as (typeof VALID_TRANSPORTS)[number];

    // ── Transport-specific validation ───────────────────────────────
    const transportError = validateTransportFields(transport, body.command, body.url);
    if (transportError) return transportError;

    // ── Optional field validation ───────────────────────────────────
    const fieldError = validateMcpFields(body);
    if (fieldError) return fieldError;

    // ── Duplicate check ─────────────────────────────────────────────
    const existing = await prisma.mcpServerConfig.findUnique({
      where: { agentId_name: { agentId: id, name: body.name as string } },
    });
    if (existing) {
      return NextResponse.json(
        { error: `An MCP server named "${body.name}" already exists for this agent` },
        { status: 409 }
      );
    }

    // ── Create record ───────────────────────────────────────────────
    const created = await prisma.mcpServerConfig.create({
      data: {
        agentId: id,
        name: (body.name as string).trim(),
        transport,
        command: typeof body.command === "string" ? body.command : null,
        args: JSON.stringify(body.args ?? []),
        url: typeof body.url === "string" ? body.url : null,
        env: JSON.stringify(body.env ?? {}),
        allowedTools: JSON.stringify(body.allowedTools ?? []),
        blockedTools: JSON.stringify(body.blockedTools ?? []),
        sandboxConfig: JSON.stringify(body.sandboxConfig ?? {}),
      },
    });

    const parsed = parseServerRow(created as unknown as Record<string, unknown>);

    return NextResponse.json(parsed, { status: 201 });
  } catch (error) {
    console.error(
      "Failed to create MCP server:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Failed to create MCP server" },
      { status: 500 }
    );
  }
}
