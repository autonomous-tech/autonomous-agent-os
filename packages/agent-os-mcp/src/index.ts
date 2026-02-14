import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { parseConfig } from "./config.js";
import { AgentOsApiClient } from "./api-client.js";
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
import { handleSyncSession } from "./tools/sync.js";

// ── Shared helpers ────────────────────────────────────────────────────

type ToolResult = { content: [{ type: "text"; text: string }]; isError?: true };

function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function errorResult(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

// Cached agent info with TTL to avoid stale data
let cachedAgentId: string | null = null;
let cachedLettaAgentId: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheAgentInfo(agent: { id: string; lettaAgentId: string | null }): void {
  cachedAgentId = agent.id;
  cachedLettaAgentId = agent.lettaAgentId;
  cacheTimestamp = Date.now();
}

async function ensureAgentInfo(client: AgentOsApiClient) {
  const isExpired = Date.now() - cacheTimestamp > CACHE_TTL_MS;
  if (!cachedAgentId || isExpired) {
    cacheAgentInfo(await client.getAgentBySlug());
  }
  return { agentId: cachedAgentId!, lettaAgentId: cachedLettaAgentId };
}

function requireLetta(lettaAgentId: string | null): string {
  if (!lettaAgentId) {
    throw new Error(
      "This agent does not have Letta memory enabled. Deploy the agent with Letta first."
    );
  }
  return lettaAgentId;
}

async function ensureLetta(client: AgentOsApiClient): Promise<string> {
  const { lettaAgentId } = await ensureAgentInfo(client);
  return requireLetta(lettaAgentId);
}

// ── Server setup ──────────────────────────────────────────────────────

export async function startServer() {
  const config = parseConfig();
  const client = new AgentOsApiClient(config.agentOsUrl, config.agentSlug);

  const server = new McpServer({
    name: "agent-os",
    version: "0.1.0",
  });

  server.tool(
    "load_context",
    "Load your full agent identity, mission, and current memory state. Call this at the start of every session.",
    {},
    async () => {
      try {
        const result = await handleLoadContext(client);
        cacheAgentInfo(result.agent);
        return textResult(result.content);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    "get_memory_blocks",
    "Read all current memory block values.",
    {},
    async () => {
      try {
        return textResult(await handleGetMemoryBlocks(client, await ensureLetta(client)));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    "core_memory_replace",
    "Find and replace text in a memory block. Use this to update existing information.",
    {
      label: z.string().describe("The memory block label (e.g. 'persona', 'decisions', 'scratchpad')"),
      old_value: z.string().describe("The exact text to find and replace"),
      new_value: z.string().describe("The new text to replace it with"),
    },
    async (args) => {
      try {
        return textResult(await handleCoreMemoryReplace(client, await ensureLetta(client), args));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    "core_memory_append",
    "Append text to a memory block. Use this to add new information.",
    {
      label: z.string().describe("The memory block label (e.g. 'persona', 'decisions', 'scratchpad')"),
      content: z.string().describe("The text to append to the block"),
    },
    async (args) => {
      try {
        return textResult(await handleCoreMemoryAppend(client, await ensureLetta(client), args));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    "archival_search",
    "Search your long-term archival memory using semantic search.",
    {
      query: z.string().describe("The search query"),
    },
    async (args) => {
      try {
        return textResult(await handleArchivalSearch(client, await ensureLetta(client), args));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    "archival_insert",
    "Store important learnings permanently in your archival memory.",
    {
      content: z.string().describe("The text to store in archival memory"),
    },
    async (args) => {
      try {
        return textResult(await handleArchivalInsert(client, await ensureLetta(client), args));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    "sync_session",
    "Send a session summary to Agent OS for memory extraction and persistence. Call this at the end of a session.",
    {
      summary: z.string().describe("A summary of what happened during this session, including key decisions and learnings"),
    },
    async (args) => {
      try {
        const { agentId } = await ensureAgentInfo(client);
        if (!agentId) throw new Error("Agent not found");
        return textResult(await handleSyncSession(client, agentId, args));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
