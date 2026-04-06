/**
 * Archival memory tools — archival_search, archival_insert.
 * Provides semantic search and long-term storage via Letta archival memory.
 */
import type { AgentOsClient } from "../api-client.js";
export declare const ARCHIVAL_SEARCH_TOOL: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            letta_agent_id: {
                type: string;
                description: string;
            };
            query: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare const ARCHIVAL_INSERT_TOOL: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            letta_agent_id: {
                type: string;
                description: string;
            };
            text: {
                type: string;
                description: string;
            };
            tags: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
        required: string[];
    };
};
export declare function handleArchivalSearch(client: AgentOsClient, args: {
    letta_agent_id: string;
    query: string;
}): Promise<string>;
export declare function handleArchivalInsert(client: AgentOsClient, args: {
    letta_agent_id: string;
    text: string;
    tags?: string[];
}): Promise<string>;
//# sourceMappingURL=archival.d.ts.map