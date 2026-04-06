/**
 * get_team_context tool — Retrieve team members, roles, and shared project blocks.
 */
export const GET_TEAM_CONTEXT_TOOL = {
    name: "get_team_context",
    description: "Get the team context: members, roles, shared project blocks (decisions, task board). " +
        "Use this to understand who your teammates are and what the team is working on.",
    inputSchema: {
        type: "object",
        properties: {
            agent_slug: {
                type: "string",
                description: "Your agent slug (to find your team)",
            },
        },
        required: ["agent_slug"],
    },
};
export async function handleGetTeamContext(client, args) {
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
            status: p.status,
            sharedBlocks: Object.keys(p.lettaBlockIds).filter((k) => p.lettaBlockIds[k]),
        })),
    };
    return JSON.stringify(context, null, 2);
}
//# sourceMappingURL=team.js.map