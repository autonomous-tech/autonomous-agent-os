import type { AgentOsClient } from "../api-client.js";

export async function handleLoadContext(
  client: AgentOsClient,
  args: { agent_slug: string }
): Promise<string> {
  const agent = await client.getAgentBySlug(args.agent_slug);

  if (!agent.lettaAgentId) {
    return JSON.stringify({
      error: "Agent has no Letta deployment. Deploy the agent in Agent OS first.",
      agent: { name: agent.name, slug: agent.slug, status: agent.status },
    });
  }

  const [blocks, team] = await Promise.all([
    client.getMemoryBlocks(agent.lettaAgentId),
    client.getTeamForAgent(args.agent_slug).catch(() => null),
  ]);

  const context: Record<string, unknown> = {
    agent: {
      name: agent.name,
      slug: agent.slug,
      description: agent.description,
      lettaAgentId: agent.lettaAgentId,
    },
    identity: agent.config,
    memoryBlocks: blocks.map((b) => ({
      label: b.label,
      value: b.value,
      limit: b.limit,
      readOnly: b.readOnly,
    })),
  };

  if (team) {
    context.team = {
      name: team.name,
      description: team.description,
      members: team.members.map((m) => ({
        name: m.agent.name,
        slug: m.agent.slug,
        role: m.role,
        description: m.agent.description,
      })),
      activeProjects: team.projects
        .filter((p) => p.status === "active")
        .map((p) => ({
          name: p.name,
          brief: p.brief,
        })),
    };
  }

  return JSON.stringify(context, null, 2);
}
