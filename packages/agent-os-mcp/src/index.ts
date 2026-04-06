import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { parseConfig } from "./config.js";
import { AgentOsClient } from "./api-client.js";
import { handleLoadContext } from "./tools/context.js";
import {
  handleGetMemoryBlocks,
  handleCoreMemoryReplace,
  handleCoreMemoryAppend,
} from "./tools/memory.js";
import {
  handleArchivalSearch,
  handleArchivalInsert,
} from "./tools/archival.js";
import { handleGetTeamContext } from "./tools/team.js";
import { handleSyncSession } from "./tools/sync.js";

type TextResult = { content: Array<{ type: "text"; text: string }>; isError?: true };

function wrapHandler<T>(handler: (args: T) => Promise<string>): (args: T) => Promise<TextResult> {
  return async (args: T) => {
    try {
      const text = await handler(args);
      return { content: [{ type: "text", text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  };
}

export async function startServer(): Promise<void> {
  const config = parseConfig();
  const apiClient = new AgentOsClient(config);

  const server = new McpServer({
    name: "agent-os",
    version: "0.1.0",
  });

  server.tool(
    "load_context",
    "Load the full agent context: identity, memory blocks, team info, and archival highlights. Call this at the start of every session to bootstrap your persistent memory.",
    { agent_slug: z.string().describe("The agent's slug identifier in Agent OS") },
    wrapHandler((args) => handleLoadContext(apiClient, args))
  );

  server.tool(
    "get_memory_blocks",
    "Read all current memory block values for this agent. Returns persona, scratchpad, memory_instructions, and any shared team blocks.",
    { letta_agent_id: z.string().describe("The Letta agent ID (from load_context)") },
    wrapHandler((args) => handleGetMemoryBlocks(apiClient, args))
  );

  server.tool(
    "core_memory_replace",
    "Find and replace text in a memory block. Use this for surgical updates — e.g., updating a user preference or correcting a project decision.",
    {
      letta_agent_id: z.string().describe("The Letta agent ID"),
      label: z.string().describe("Memory block label (e.g. 'persona', 'decisions', 'scratchpad')"),
      old_text: z.string().describe("The exact text to find in the block"),
      new_text: z.string().describe("The replacement text"),
    },
    wrapHandler((args) => handleCoreMemoryReplace(apiClient, args))
  );

  server.tool(
    "core_memory_append",
    "Append text to the end of a memory block. Use this to log a new decision, add a task update, or record something learned. Be concise — blocks have character limits.",
    {
      letta_agent_id: z.string().describe("The Letta agent ID"),
      label: z.string().describe("Memory block label (e.g. 'decisions', 'task_board', 'scratchpad')"),
      text: z.string().describe("Text to append to the block"),
    },
    wrapHandler((args) => handleCoreMemoryAppend(apiClient, args))
  );

  server.tool(
    "archival_search",
    "Semantic search over your long-term archival memory. Use this to recall past learnings, craft knowledge, skill patterns, or previously stored information.",
    {
      letta_agent_id: z.string().describe("The Letta agent ID"),
      query: z.string().describe("Natural language search query"),
    },
    wrapHandler((args) => handleArchivalSearch(apiClient, args))
  );

  server.tool(
    "archival_insert",
    "Store information in long-term archival memory. Use this for craft knowledge, techniques, patterns, and learnings that should persist across sessions.",
    {
      letta_agent_id: z.string().describe("The Letta agent ID"),
      text: z.string().describe("The text content to store (max 50000 chars)"),
      tags: z.array(z.string()).optional().describe("Optional tags for categorization"),
    },
    wrapHandler((args) => handleArchivalInsert(apiClient, args))
  );

  server.tool(
    "get_team_context",
    "Get the team context: members, roles, shared project blocks. Use this to understand who your teammates are and what the team is working on.",
    { agent_slug: z.string().describe("Your agent slug (to find your team)") },
    wrapHandler((args) => handleGetTeamContext(apiClient, args))
  );

  server.tool(
    "sync_session",
    "Send a session summary to Agent OS for server-side memory extraction. Agent OS will analyze, categorize learnings, and write them to the appropriate memory blocks.",
    {
      agent_slug: z.string().describe("Your agent slug"),
      summary: z.string().describe("Summary of what happened in this session"),
      decisions: z.array(z.string()).optional().describe("Project decisions made"),
      preferences: z.array(z.string()).optional().describe("User preferences observed"),
      knowledge: z.array(z.string()).optional().describe("Craft knowledge learned"),
      task_updates: z.array(z.string()).optional().describe("Task status changes"),
    },
    wrapHandler((args) => handleSyncSession(apiClient, args))
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[agent-os-mcp] Connected to Agent OS at ${config.baseUrl}`);
  if (config.defaultSlug) {
    console.error(`[agent-os-mcp] Default agent: ${config.defaultSlug}`);
  }
}

// Auto-start when imported directly (not via bin/)
if (process.argv[1]?.endsWith("index.js") || process.argv[1]?.endsWith("index.ts")) {
  startServer().catch((err) => {
    console.error("[agent-os-mcp] Fatal:", err);
    process.exit(1);
  });
}
