import type { AgentOsClient } from "../api-client.js";

export async function handleGetTeamContext(
  client: AgentOsClient,
  args: { agent_slug: string }
): Promise<string> {
  const team = await client.getTeamForAgent(args.agent_slug);

  if (!team) {
    return JSON.stringify({
      error: "No team found for this agent",
      hint: "This agent may not be part of a team. Use individual memory tools instead.",
    });
  }

  const context = {
    team: {
      name: team.name,
      description: team.description,
    },
    members: team.members.map((m) => ({
      name: m.agent.name,
      slug: m.agent.slug,
      role: m.role,
      description: m.agent.description,
      hasMemory: !!m.lettaAgentId,
    })),
    projects: team.projects
      .filter((p) => p.status === "active")
      .map((p) => ({
        name: p.name,
        brief: p.brief,
        sharedBlocks: Object.keys(p.lettaBlockIds).filter(
          (k) => p.lettaBlockIds[k]
        ),
      })),
  };

  return JSON.stringify(context, null, 2);
}
