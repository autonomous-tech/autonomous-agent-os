/**
 * Memory block tools — get_memory_blocks, core_memory_replace, core_memory_append.
 * These mirror the Letta native memory tools but route through Agent OS API.
 */
import type { AgentOsClient } from "../api-client.js";
export declare const GET_MEMORY_BLOCKS_TOOL: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            letta_agent_id: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare const CORE_MEMORY_REPLACE_TOOL: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            letta_agent_id: {
                type: string;
                description: string;
            };
            label: {
                type: string;
                description: string;
            };
            old_text: {
                type: string;
                description: string;
            };
            new_text: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare const CORE_MEMORY_APPEND_TOOL: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            letta_agent_id: {
                type: string;
                description: string;
            };
            label: {
                type: string;
                description: string;
            };
            text: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function handleGetMemoryBlocks(client: AgentOsClient, args: {
    letta_agent_id: string;
}): Promise<string>;
export declare function handleCoreMemoryReplace(client: AgentOsClient, args: {
    letta_agent_id: string;
    label: string;
    old_text: string;
    new_text: string;
}): Promise<string>;
export declare function handleCoreMemoryAppend(client: AgentOsClient, args: {
    letta_agent_id: string;
    label: string;
    text: string;
}): Promise<string>;
//# sourceMappingURL=memory.d.ts.map