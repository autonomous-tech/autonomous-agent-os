/**
 * Archival memory tools — archival_search, archival_insert.
 * Provides semantic search and long-term storage via Letta archival memory.
 */
// ── Tool Definitions ─────────────────────────────────────────────────
export const ARCHIVAL_SEARCH_TOOL = {
    name: "archival_search",
    description: "Semantic search over your long-term archival memory. " +
        "Use this to recall past learnings, craft knowledge, skill patterns, " +
        "or previously stored information. Returns the most relevant passages.",
    inputSchema: {
        type: "object",
        properties: {
            letta_agent_id: {
                type: "string",
                description: "The Letta agent ID",
            },
            query: {
                type: "string",
                description: "Natural language search query",
            },
        },
        required: ["letta_agent_id", "query"],
    },
};
export const ARCHIVAL_INSERT_TOOL = {
    name: "archival_insert",
    description: "Store information in long-term archival memory. " +
        "Use this for craft knowledge, techniques, patterns, and learnings " +
        "that should persist across sessions. Archival memory has no size limit " +
        "and supports semantic search for retrieval.",
    inputSchema: {
        type: "object",
        properties: {
            letta_agent_id: {
                type: "string",
                description: "The Letta agent ID",
            },
            text: {
                type: "string",
                description: "The text content to store (max 50000 chars)",
            },
            tags: {
                type: "array",
                items: { type: "string" },
                description: "Optional tags for categorization (e.g. ['frontend', 'react', 'pattern'])",
            },
        },
        required: ["letta_agent_id", "text"],
    },
};
// ── Handlers ─────────────────────────────────────────────────────────
export async function handleArchivalSearch(client, args) {
    const result = await client.searchArchival(args.letta_agent_id, args.query);
    const passages = result.passages.map((p) => ({
        id: p.id,
        content: p.content || p.text,
        tags: p.tags,
    }));
    if (passages.length === 0) {
        return JSON.stringify({
            results: [],
            message: "No matching passages found in archival memory",
        });
    }
    return JSON.stringify({ results: passages, count: result.count ?? passages.length }, null, 2);
}
export async function handleArchivalInsert(client, args) {
    if (args.text.length > 50000) {
        return JSON.stringify({
            error: "Text exceeds 50000 character limit",
            hint: "Break into smaller passages and insert separately",
        });
    }
    await client.insertArchival(args.letta_agent_id, args.text, args.tags);
    return JSON.stringify({
        success: true,
        message: "Stored in archival memory",
        length: args.text.length,
        tags: args.tags ?? [],
    });
}
//# sourceMappingURL=archival.js.map