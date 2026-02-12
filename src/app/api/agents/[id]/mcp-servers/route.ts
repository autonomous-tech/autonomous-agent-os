import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const VALID_TRANSPORTS = ["stdio", "sse", "http"] as const;
const MAX_NAME_LENGTH = 100;

/** JSON fields stored as strings in the database. */
const JSON_FIELDS = [
  "args",
  "env",
  "allowedTools",
  "blockedTools",
  "sandboxConfig",
] as const;

/** Parse all JSON string fields on an McpServerConfig row into real values. */
function parseServerRow(row: Record<string, unknown>): Record<string, unknown> {
  const parsed = { ...row };
  for (const field of JSON_FIELDS) {
    if (typeof parsed[field] === "string") {
      try {
        parsed[field] = JSON.parse(parsed[field] as string);
      } catch {
        // leave as-is if unparseable
      }
    }
  }
  return parsed;
}

/** Basic URL format validation (must be http or https). */
function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

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
        {
          error: `name is required and must be a string of 1–${MAX_NAME_LENGTH} characters`,
        },
        { status: 400 }
      );
    }

    // ── Required: transport ─────────────────────────────────────────
    if (
      typeof body.transport !== "string" ||
      !VALID_TRANSPORTS.includes(body.transport as (typeof VALID_TRANSPORTS)[number])
    ) {
      return NextResponse.json(
        {
          error: `transport is required and must be one of: ${VALID_TRANSPORTS.join(", ")}`,
        },
        { status: 400 }
      );
    }
    const transport = body.transport as (typeof VALID_TRANSPORTS)[number];

    // ── Transport-specific validation ───────────────────────────────
    if (transport === "stdio") {
      if (typeof body.command !== "string" || body.command.trim().length === 0) {
        return NextResponse.json(
          { error: "command is required for stdio transport" },
          { status: 400 }
        );
      }
    } else {
      // sse or http
      if (typeof body.url !== "string" || !isValidUrl(body.url)) {
        return NextResponse.json(
          { error: "A valid http/https url is required for sse and http transports" },
          { status: 400 }
        );
      }
    }

    // ── Optional field validation ───────────────────────────────────
    if (body.args !== undefined) {
      if (!Array.isArray(body.args)) {
        return NextResponse.json(
          { error: "args must be an array" },
          { status: 400 }
        );
      }
    }
    if (body.env !== undefined) {
      if (
        typeof body.env !== "object" ||
        body.env === null ||
        Array.isArray(body.env)
      ) {
        return NextResponse.json(
          { error: "env must be an object" },
          { status: 400 }
        );
      }
    }
    if (body.allowedTools !== undefined) {
      if (!Array.isArray(body.allowedTools)) {
        return NextResponse.json(
          { error: "allowedTools must be an array" },
          { status: 400 }
        );
      }
    }
    if (body.blockedTools !== undefined) {
      if (!Array.isArray(body.blockedTools)) {
        return NextResponse.json(
          { error: "blockedTools must be an array" },
          { status: 400 }
        );
      }
    }
    if (body.sandboxConfig !== undefined) {
      if (
        typeof body.sandboxConfig !== "object" ||
        body.sandboxConfig === null ||
        Array.isArray(body.sandboxConfig)
      ) {
        return NextResponse.json(
          { error: "sandboxConfig must be an object" },
          { status: 400 }
        );
      }
    }

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
