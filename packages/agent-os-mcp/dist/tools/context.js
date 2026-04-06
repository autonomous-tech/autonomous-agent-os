/**
 * load_context tool — Bootstrap an agent session with full identity + memory + team context.
 * Called at the start of every Claude Code session.
 */
export const LOAD_CONTEXT_TOOL = {
    name: "load_context",
    description: "Load the full agent context: identity, memory blocks, team info, and archival highlights. " +
        "Call this at the start of every session to bootstrap your persistent memory.",
    inputSchema: {
        type: "object",
        properties: {
            agent_slug: {
                type: "string",
                description: "The agent's slug identifier in Agent OS",
            },
        },
        required: ["agent_slug"],
    },
};
export async function handleLoadContext(client, args) {
    const agent = await client.getAgentBySlug(args.agent_slug);
    if (!agent.lettaAgentId) {
        return JSON.stringify({
            error: "Agent has no Letta deployment. Deploy the agent in Agent OS first.",
            agent: { name: agent.name, slug: agent.slug, status: agent.status },
        });
    }
    // Fetch memory blocks and team context in parallel
    const [blocks, team] = await Promise.all([
        client.getMemoryBlocks(agent.lettaAgentId),
        client.getTeamForAgent(args.agent_slug).catch(() => null),
    ]);
    // Build structured context
    const context = {
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
//# sourceMappingURL=context.js.map