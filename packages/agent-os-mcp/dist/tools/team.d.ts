/**
 * get_team_context tool — Retrieve team members, roles, and shared project blocks.
 */
import type { AgentOsClient } from "../api-client.js";
export declare const GET_TEAM_CONTEXT_TOOL: {
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
export declare function handleGetTeamContext(client: AgentOsClient, args: {
    agent_slug: string;
}): Promise<string>;
//# sourceMappingURL=team.d.ts.map