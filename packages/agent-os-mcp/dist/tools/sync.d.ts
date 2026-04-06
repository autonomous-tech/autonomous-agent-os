/**
 * sync_session tool — Send session summary for server-side memory extraction.
 * Called at the end of a Claude Code session (via hook or manually).
 */
import type { AgentOsClient } from "../api-client.js";
export declare const SYNC_SESSION_TOOL: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            agent_slug: {
                type: string;
                description: string;
            };
            summary: {
                type: string;
                description: string;
            };
            decisions: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            preferences: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            knowledge: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            task_updates: {
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
export declare function handleSyncSession(client: AgentOsClient, args: {
    agent_slug: string;
    summary: string;
    decisions?: string[];
    preferences?: string[];
    knowledge?: string[];
    task_updates?: string[];
}): Promise<string>;
//# sourceMappingURL=sync.d.ts.map