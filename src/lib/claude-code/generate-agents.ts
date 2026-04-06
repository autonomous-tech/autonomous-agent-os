import type { AgentConfig } from "@/lib/types";
import { getTools, getTriggers } from "@/lib/types";

export interface SubagentDefinition {
  path: string;
  content: string;
  name: string;
}

interface AgentInput {
  name: string;
  slug: string;
  description: string;
  config: AgentConfig;
  lettaAgentId: string | null;
}

export function generateSubagentDefinition(agent: AgentInput): SubagentDefinition {
  const { config, name, slug, description } = agent;
  const safeName = slug.replace(/[^a-z0-9-]/g, "-");

  const frontmatter = buildFrontmatter(name, description, agent.lettaAgentId);
  const body = buildBody(config, name, agent.lettaAgentId, slug);

  return {
    path: `.claude/agents/${safeName}/${safeName}.md`,
    name,
    content: `${frontmatter}\n${body}`,
  };
}

function buildFrontmatter(
  name: string,
  description: string,
  lettaAgentId: string | null
): string {
  const tools = ["Read", "Write", "Edit", "Bash", "Glob", "Grep"];

  if (lettaAgentId) {
    tools.push("mcp__agent-os__*");
  }

  const lines = [
    "---",
    `name: ${yamlEscape(name)}`,
    `description: ${yamlEscape(description || `${name} agent`)}`,
    `tools: ${tools.join(", ")}`,
    `model: sonnet`,
    `maxTurns: 25`,
    "---",
  ];

  return lines.join("\n");
}

function buildBody(
  config: AgentConfig,
  name: string,
  lettaAgentId: string | null,
  slug: string
): string {
  const sections: string[] = [];

  sections.push(`\nYou are ${name}.`);

  if (config.identity) {
    const id = config.identity;
    const identityLines = ["## Identity"];
    if (id.tone) identityLines.push(`- Tone: ${id.tone}`);
    if (id.vibe) identityLines.push(`- Vibe: ${id.vibe}`);
    if (id.greeting) identityLines.push(`- Greeting: "${id.greeting}"`);
    sections.push(identityLines.join("\n"));
  }

  if (config.mission) {
    const m = config.mission;
    const missionLines = ["## Mission"];
    if (m.description) missionLines.push(m.description);

    if (m.tasks?.length) {
      missionLines.push("\n### Key Tasks");
      for (const t of m.tasks) missionLines.push(`- ${t}`);
    }

    if (m.exclusions?.length) {
      missionLines.push("\n### Exclusions");
      for (const e of m.exclusions) missionLines.push(`- Do NOT ${e}`);
    }

    sections.push(missionLines.join("\n"));
  }

  const tools = getTools(config);
  if (tools.length > 0) {
    const capLines = ["## Capabilities"];
    for (const t of tools) capLines.push(`- **${t.name}** (${t.access}): ${t.description}`);
    sections.push(capLines.join("\n"));
  }

  if (lettaAgentId) {
    sections.push(buildMemoryProtocol(slug));
  }

  if (config.guardrails?.behavioral?.length) {
    const guardLines = ["## Guardrails"];
    for (const g of config.guardrails.behavioral) guardLines.push(`- ${g}`);
    sections.push(guardLines.join("\n"));
  }

  const triggers = getTriggers(config);
  if (triggers.length > 0) {
    const trigLines = ["## When to Activate"];
    for (const t of triggers) trigLines.push(`- ${t.description}`);
    sections.push(trigLines.join("\n"));
  }

  return sections.join("\n\n");
}

function buildMemoryProtocol(slug: string): string {
  return `## Memory Protocol

You have persistent memory managed by Agent OS. Follow this protocol:

**At the start of each task:**
1. Call \`agent-os__load_context\` with agent_slug="${slug}" to load your current memory
2. Review your persona block and project decisions before starting work

**During work:**
- When you make a significant project decision, call \`agent-os__core_memory_append\` on the "decisions" block
- When you learn a user preference, call \`agent-os__core_memory_replace\` on your "persona" block
- To recall past knowledge, call \`agent-os__archival_search\` with a natural language query
- To store craft knowledge for future use, call \`agent-os__archival_insert\`

**At the end of your task:**
- Call \`agent-os__sync_session\` with a summary of what you learned and accomplished`;
}

function yamlEscape(s: string): string {
  if (/[:\"'#\n\\]/.test(s)) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
  }
  return s;
}
