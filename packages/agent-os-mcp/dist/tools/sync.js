/**
 * sync_session tool — Send session summary for server-side memory extraction.
 * Called at the end of a Claude Code session (via hook or manually).
 */
export const SYNC_SESSION_TOOL = {
    name: "sync_session",
    description: "Send a session summary to Agent OS for server-side memory extraction. " +
        "Agent OS will analyze the summary, categorize learnings, and write them " +
        "to the appropriate memory blocks. Call this at the end of your task " +
        "or when a SubagentStop hook fires.",
    inputSchema: {
        type: "object",
        properties: {
            agent_slug: {
                type: "string",
                description: "Your agent slug",
            },
            summary: {
                type: "string",
                description: "A summary of what happened in this session — decisions made, " +
                    "things learned, problems solved, patterns discovered",
            },
            decisions: {
                type: "array",
                items: { type: "string" },
                description: "Specific project decisions made during this session",
            },
            preferences: {
                type: "array",
                items: { type: "string" },
                description: "User preferences or work style observations",
            },
            knowledge: {
                type: "array",
                items: { type: "string" },
                description: "Craft knowledge or technical patterns learned",
            },
            task_updates: {
                type: "array",
                items: { type: "string" },
                description: "Task status changes (completed, blocked, etc.)",
            },
        },
        required: ["agent_slug", "summary"],
    },
};
export async function handleSyncSession(client, args) {
    // Resolve slug to agent ID
    const agent = await client.getAgentBySlug(args.agent_slug);
    const result = await client.syncSession(agent.id, {
        summary: args.summary,
        decisions: args.decisions,
        preferences: args.preferences,
        knowledge: args.knowledge,
        taskUpdates: args.task_updates,
    });
    return JSON.stringify({
        success: true,
        message: "Session synced — memory updated",
        persisted: result.persisted,
    }, null, 2);
}
//# sourceMappingURL=sync.js.map