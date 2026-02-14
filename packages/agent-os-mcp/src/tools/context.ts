import type { AgentOsApiClient } from "../api-client.js";

export interface LoadContextResult {
  content: string;
  agent: { id: string; lettaAgentId: string | null };
}

export async function handleLoadContext(
  client: AgentOsApiClient
): Promise<LoadContextResult> {
  const agent = await client.getAgentBySlug();

  const sections: string[] = [
    `# Agent: ${agent.name}`,
    `Slug: ${agent.slug}`,
    `Status: ${agent.status}`,
  ];

  const config = agent.config;

  const identity = config.identity as Record<string, unknown> | undefined;
  if (identity) {
    sections.push(`\n## Identity`);
    if (identity.vibe) sections.push(`Personality: ${identity.vibe}`);
    if (identity.tone) sections.push(`Tone: ${identity.tone}`);
  }

  // Mission
  const mission = config.mission as Record<string, unknown> | undefined;
  if (mission) {
    sections.push(`\n## Mission`);
    if (mission.description) sections.push(String(mission.description));
    if (Array.isArray(mission.tasks) && mission.tasks.length > 0) {
      sections.push(`\nKey Tasks:`);
      for (const task of mission.tasks) {
        sections.push(`- ${task}`);
      }
    }
  }

  // Memory blocks (if Letta is enabled)
  if (agent.lettaAgentId) {
    try {
      const blocks = await client.getMemoryBlocks(agent.lettaAgentId);
      sections.push(`\n## Current Memory`);
      for (const block of blocks) {
        sections.push(`\n### ${block.label}`);
        sections.push(block.value);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      sections.push(`\n## Memory\nFailed to load memory blocks: ${msg}`);
    }
  }

  return {
    content: sections.join("\n"),
    agent: { id: agent.id, lettaAgentId: agent.lettaAgentId },
  };
}
