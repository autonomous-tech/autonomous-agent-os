/**
 * HTTP client wrapping Agent OS API endpoints.
 * All calls are unauthenticated (local dev) — add auth headers here if needed later.
 */
import type { McpConfig } from "./config.js";
export interface MemoryBlock {
    id: string;
    label: string;
    value: string;
    limit: number;
    description?: string;
    readOnly?: boolean;
}
export interface ArchivalPassage {
    id: string;
    content?: string;
    text?: string;
    timestamp?: string;
    created_at?: string;
    tags?: string[];
}
export interface AgentInfo {
    id: string;
    name: string;
    slug: string;
    description: string;
    config: Record<string, unknown>;
    lettaAgentId: string | null;
    status: string;
}
export interface TeamInfo {
    id: string;
    name: string;
    description: string;
    members: Array<{
        agentId: string;
        role: string;
        lettaAgentId: string | null;
        agent: {
            name: string;
            slug: string;
            description: string;
        };
    }>;
    projects: Array<{
        id: string;
        name: string;
        brief: string;
        status: string;
        lettaBlockIds: Record<string, string>;
    }>;
}
export interface SyncSessionResult {
    persisted: Array<{
        category: string;
        block: string;
        summary: string;
    }>;
}
export declare class AgentOsClient {
    private baseUrl;
    constructor(config: McpConfig);
    private fetch;
    getAgentBySlug(slug: string): Promise<AgentInfo>;
    getMemoryBlocks(lettaId: string): Promise<MemoryBlock[]>;
    getMemoryBlock(lettaId: string, label: string): Promise<MemoryBlock>;
    updateMemoryBlock(lettaId: string, label: string, value: string): Promise<MemoryBlock>;
    searchArchival(lettaId: string, query: string): Promise<{
        passages: ArchivalPassage[];
        count?: number;
    }>;
    insertArchival(lettaId: string, text: string, tags?: string[]): Promise<{
        passages: unknown;
    }>;
    getTeamForAgent(agentSlug: string): Promise<TeamInfo | null>;
    syncSession(agentId: string, data: {
        summary: string;
        decisions?: string[];
        preferences?: string[];
        knowledge?: string[];
        taskUpdates?: string[];
    }): Promise<SyncSessionResult>;
}
//# sourceMappingURL=api-client.d.ts.map