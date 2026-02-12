import type { McpServerDefinition } from "@/lib/runtime/tools.types";

/**
 * Pre-configured MCP server definitions for common integrations.
 * Each preset is a ready-to-use configuration that can be customized as needed.
 */
export const MCP_PRESETS: Record<string, McpServerDefinition> = {
  filesystem: {
    name: "filesystem",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp/agent-workspace"],
    sandbox: {
      maxExecutionMs: 10000,
      allowNetwork: false,
    },
  },

  jiraCloud: {
    name: "jira-cloud",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@anthropic/mcp-server-jira"],
    env: {
      JIRA_URL: "",
      JIRA_EMAIL: "",
      JIRA_API_TOKEN: "",
    },
    sandbox: {
      maxExecutionMs: 15000,
      allowNetwork: true,
    },
  },

  browser: {
    name: "browser",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@anthropic/mcp-server-puppeteer"],
    sandbox: {
      maxExecutionMs: 30000,
      allowNetwork: true,
    },
  },

  git: {
    name: "git",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@anthropic/mcp-server-git"],
    sandbox: {
      maxExecutionMs: 15000,
      allowNetwork: false,
    },
  },
};

/**
 * Retrieve a deep copy of a preset by key.
 * Returns undefined if the preset does not exist.
 *
 * @param key - The preset key (e.g., "filesystem", "jiraCloud", "browser", "git")
 * @returns A deep copy of the preset, or undefined if not found
 */
export function getPreset(key: string): McpServerDefinition | undefined {
  const preset = MCP_PRESETS[key];
  if (!preset) {
    return undefined;
  }

  // Create a deep copy to prevent accidental mutations
  return JSON.parse(JSON.stringify(preset)) as McpServerDefinition;
}

/**
 * List metadata about all available presets.
 * Useful for UI dropdowns or help systems.
 *
 * @returns Array of preset metadata with key, name, and description
 */
export function listPresets(): Array<{
  key: string;
  name: string;
  description: string;
}> {
  return [
    {
      key: "filesystem",
      name: "Filesystem",
      description:
        "Local filesystem access within /tmp/agent-workspace directory with 10s timeout",
    },
    {
      key: "jiraCloud",
      name: "Jira Cloud",
      description:
        "Jira Cloud integration for issue tracking, project management, and workflow automation (requires JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN)",
    },
    {
      key: "browser",
      name: "Browser (Puppeteer)",
      description:
        "Headless browser automation via Puppeteer for web scraping and interaction with 30s timeout",
    },
    {
      key: "git",
      name: "Git",
      description:
        "Git repository operations including clone, commit, push, and diff with 15s timeout",
    },
  ];
}
