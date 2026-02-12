import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { McpClientManager } from "@/lib/runtime/mcp-client";
import type { McpServerDefinition } from "@/lib/runtime/tools.types";

// POST /api/agents/[id]/mcp-servers/[serverId]/test — Test MCP server connection
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; serverId: string }> }
) {
  let manager: McpClientManager | null = null;

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

    // Build McpServerDefinition from the database row
    const definition: McpServerDefinition = {
      name: server.name,
      transport: server.transport as McpServerDefinition["transport"],
      command: server.command ?? undefined,
      args: safeParseArray(server.args),
      url: server.url ?? undefined,
      env: safeParseObject(server.env),
      allowedTools: safeParseArray(server.allowedTools),
      blockedTools: safeParseArray(server.blockedTools),
      sandbox: safeParseObject(server.sandboxConfig),
      status: server.status as "active" | "inactive",
    };

    // Attempt connection
    manager = new McpClientManager();
    await manager.connect([definition]);

    if (!manager.isConnected(definition.name)) {
      return NextResponse.json({
        connected: false,
        error: "Server did not connect successfully",
      });
    }

    // List available tools
    const tools = await manager.listTools();

    // Disconnect before responding
    await manager.disconnect();
    manager = null;

    return NextResponse.json({
      connected: true,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        serverName: t.serverName,
      })),
    });
  } catch (error) {
    // Ensure cleanup on failure
    if (manager) {
      try {
        await manager.disconnect();
      } catch {
        // ignore disconnect errors during cleanup
      }
    }

    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("MCP server test failed:", message);

    return NextResponse.json({
      connected: false,
      error: "Connection test failed",
    });
  }
}

/** Safely parse a JSON string expected to be an array, returning [] on failure. */
function safeParseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Safely parse a JSON string expected to be an object, returning {} on failure. */
function safeParseObject(value: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}
