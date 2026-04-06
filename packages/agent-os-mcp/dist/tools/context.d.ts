/**
 * load_context tool — Bootstrap an agent session with full identity + memory + team context.
 * Called at the start of every Claude Code session.
 */
import type { AgentOsClient } from "../api-client.js";
export declare const LOAD_CONTEXT_TOOL: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            agent_slug: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function handleLoadContext(client: AgentOsClient, args: {
    agent_slug: string;
}): Promise<string>;
//# sourceMappingURL=context.d.ts.map