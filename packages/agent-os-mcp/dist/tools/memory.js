/**
 * Memory block tools — get_memory_blocks, core_memory_replace, core_memory_append.
 * These mirror the Letta native memory tools but route through Agent OS API.
 */
// ── Tool Definitions ─────────────────────────────────────────────────
export const GET_MEMORY_BLOCKS_TOOL = {
    name: "get_memory_blocks",
    description: "Read all current memory block values for this agent. " +
        "Returns persona, scratchpad, memory_instructions, and any shared team blocks.",
    inputSchema: {
        type: "object",
        properties: {
            letta_agent_id: {
                type: "string",
                description: "The Letta agent ID (from load_context)",
            },
        },
        required: ["letta_agent_id"],
    },
};
export const CORE_MEMORY_REPLACE_TOOL = {
    name: "core_memory_replace",
    description: "Find and replace text in a memory block. Use this for surgical updates — " +
        "e.g., updating a user preference or correcting a project decision. " +
        "Provide the block label, the old text to find, and the new text to replace it with.",
    inputSchema: {
        type: "object",
        properties: {
            letta_agent_id: {
                type: "string",
                description: "The Letta agent ID",
            },
            label: {
                type: "string",
                description: "Memory block label (e.g. 'persona', 'decisions', 'scratchpad')",
            },
            old_text: {
                type: "string",
                description: "The exact text to find in the block",
            },
            new_text: {
                type: "string",
                description: "The replacement text",
            },
        },
        required: ["letta_agent_id", "label", "old_text", "new_text"],
    },
};
export const CORE_MEMORY_APPEND_TOOL = {
    name: "core_memory_append",
    description: "Append text to the end of a memory block. Use this to log a new decision, " +
        "add a task update, or record something learned. " +
        "Be concise — blocks have character limits.",
    inputSchema: {
        type: "object",
        properties: {
            letta_agent_id: {
                type: "string",
                description: "The Letta agent ID",
            },
            label: {
                type: "string",
                description: "Memory block label (e.g. 'decisions', 'task_board', 'scratchpad')",
            },
            text: {
                type: "string",
                description: "Text to append to the block",
            },
        },
        required: ["letta_agent_id", "label", "text"],
    },
};
// ── Handlers ─────────────────────────────────────────────────────────
export async function handleGetMemoryBlocks(client, args) {
    const blocks = await client.getMemoryBlocks(args.letta_agent_id);
    return JSON.stringify(blocks.map((b) => ({
        label: b.label,
        value: b.value,
        limit: b.limit,
        readOnly: b.readOnly,
        usage: `${b.value.length}/${b.limit}`,
    })), null, 2);
}
export async function handleCoreMemoryReplace(client, args) {
    // Read current value
    const block = await client.getMemoryBlock(args.letta_agent_id, args.label);
    if (block.readOnly) {
        return JSON.stringify({ error: `Block "${args.label}" is read-only` });
    }
    if (!block.value.includes(args.old_text)) {
        return JSON.stringify({
            error: `Text not found in block "${args.label}"`,
            hint: "Check the exact text — it must match character-for-character",
        });
    }
    const newValue = block.value.replace(args.old_text, args.new_text);
    if (newValue.length > block.limit) {
        return JSON.stringify({
            error: `Replacement would exceed block limit (${newValue.length}/${block.limit})`,
            hint: "Make the replacement shorter or remove other content first",
        });
    }
    const updated = await client.updateMemoryBlock(args.letta_agent_id, args.label, newValue);
    return JSON.stringify({
        success: true,
        label: updated.label,
        usage: `${updated.value.length}/${updated.limit}`,
    });
}
export async function handleCoreMemoryAppend(client, args) {
    const block = await client.getMemoryBlock(args.letta_agent_id, args.label);
    if (block.readOnly) {
        return JSON.stringify({ error: `Block "${args.label}" is read-only` });
    }
    const newValue = block.value + "\n" + args.text;
    if (newValue.length > block.limit) {
        return JSON.stringify({
            error: `Append would exceed block limit (${newValue.length}/${block.limit})`,
            hint: "Use core_memory_replace to update existing content, or store in archival memory",
        });
    }
    const updated = await client.updateMemoryBlock(args.letta_agent_id, args.label, newValue);
    return JSON.stringify({
        success: true,
        label: updated.label,
        usage: `${updated.value.length}/${updated.limit}`,
    });
}
//# sourceMappingURL=memory.js.map