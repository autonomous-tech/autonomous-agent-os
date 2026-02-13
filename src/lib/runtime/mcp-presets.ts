import type { McpServerDefinition } from "@/lib/runtime/tools.types";

// ── Preset Metadata ──────────────────────────────────────────────────

interface PresetMeta {
  definition: McpServerDefinition;
  label: string;
  description: string;
}

/**
 * Pre-configured MCP server definitions for common integrations.
 * Each preset includes the server definition plus display metadata.
 */
const PRESET_REGISTRY: Record<string, PresetMeta> = {
  filesystem: {
    label: "Filesystem",
    description:
      "Local filesystem access within /tmp/agent-workspace directory with 10s timeout",
    definition: {
      name: "filesystem",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp/agent-workspace"],
      sandbox: { maxExecutionMs: 10000, allowNetwork: false },
    },
  },

  jiraCloud: {
    label: "Jira Cloud",
    description:
      "Jira Cloud integration for issue tracking, project management, and workflow automation (requires JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN)",
    definition: {
      name: "jira-cloud",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@anthropic/mcp-server-jira"],
      env: { JIRA_URL: "", JIRA_EMAIL: "", JIRA_API_TOKEN: "" },
      sandbox: { maxExecutionMs: 15000, allowNetwork: true },
    },
  },

  browser: {
    label: "Browser (Puppeteer)",
    description:
      "Headless browser automation via Puppeteer for web scraping and interaction with 30s timeout",
    definition: {
      name: "browser",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@anthropic/mcp-server-puppeteer"],
      sandbox: { maxExecutionMs: 30000, allowNetwork: true },
    },
  },

  git: {
    label: "Git",
    description:
      "Git repository operations including clone, commit, push, and diff with 15s timeout",
    definition: {
      name: "git",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@anthropic/mcp-server-git"],
      sandbox: { maxExecutionMs: 15000, allowNetwork: false },
    },
  },

  vercel: {
    label: "Vercel",
    description:
      "Vercel platform integration for deployments, domains, and project management (requires VERCEL_TOKEN)",
    definition: {
      name: "vercel",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@vercel/mcp-adapter"],
      env: { VERCEL_TOKEN: "" },
      sandbox: { maxExecutionMs: 30000, allowNetwork: true },
    },
  },
};

// ── Public API ────────────────────────────────────────────────────────

/** Map of preset key to McpServerDefinition (preserves existing public shape). */
export const MCP_PRESETS: Record<string, McpServerDefinition> = Object.fromEntries(
  Object.entries(PRESET_REGISTRY).map(([key, meta]) => [key, meta.definition])
);

/**
 * Retrieve a deep copy of a preset by key.
 * Returns undefined if the preset does not exist.
 */
export function getPreset(key: string): McpServerDefinition | undefined {
  const entry = PRESET_REGISTRY[key];
  if (!entry) return undefined;

  return JSON.parse(JSON.stringify(entry.definition)) as McpServerDefinition;
}

/**
 * List metadata about all available presets.
 * Derived from the preset registry to stay in sync automatically.
 */
export function listPresets(): Array<{
  key: string;
  name: string;
  description: string;
}> {
  return Object.entries(PRESET_REGISTRY).map(([key, meta]) => ({
    key,
    name: meta.label,
    description: meta.description,
  }));
}
