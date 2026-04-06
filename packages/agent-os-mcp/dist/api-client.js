/**
 * HTTP client wrapping Agent OS API endpoints.
 * All calls are unauthenticated (local dev) — add auth headers here if needed later.
 */
// ── Client ───────────────────────────────────────────────────────────
export class AgentOsClient {
    baseUrl;
    constructor(config) {
        this.baseUrl = config.baseUrl;
    }
    async fetch(path, init) {
        const url = `${this.baseUrl}${path}`;
        const res = await fetch(url, {
            ...init,
            headers: {
                "Content-Type": "application/json",
                ...init?.headers,
            },
        });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`Agent OS API error ${res.status}: ${path} — ${body}`);
        }
        return res.json();
    }
    // ── Agent resolution ─────────────────────────────────────────────
    async getAgentBySlug(slug) {
        return this.fetch(`/api/agents/by-slug/${encodeURIComponent(slug)}`);
    }
    // ── Memory blocks ────────────────────────────────────────────────
    async getMemoryBlocks(lettaId) {
        const res = await this.fetch(`/api/letta/agents/${encodeURIComponent(lettaId)}/memory`);
        return res.blocks;
    }
    async getMemoryBlock(lettaId, label) {
        return this.fetch(`/api/letta/agents/${encodeURIComponent(lettaId)}/memory/${encodeURIComponent(label)}`);
    }
    async updateMemoryBlock(lettaId, label, value) {
        return this.fetch(`/api/letta/agents/${encodeURIComponent(lettaId)}/memory/${encodeURIComponent(label)}`, { method: "PUT", body: JSON.stringify({ value }) });
    }
    // ── Archival memory ──────────────────────────────────────────────
    async searchArchival(lettaId, query) {
        return this.fetch(`/api/letta/agents/${encodeURIComponent(lettaId)}/archival?q=${encodeURIComponent(query)}`);
    }
    async insertArchival(lettaId, text, tags) {
        return this.fetch(`/api/letta/agents/${encodeURIComponent(lettaId)}/archival`, { method: "POST", body: JSON.stringify({ text, ...(tags ? { tags } : {}) }) });
    }
    // ── Team ─────────────────────────────────────────────────────────
    async getTeamForAgent(agentSlug) {
        // Get the agent first to find its ID, then look up teams
        const agent = await this.getAgentBySlug(agentSlug);
        const teams = await this.fetch("/api/teams");
        // Find a team that contains this agent
        for (const team of teams) {
            const member = team.members?.find((m) => m.agentId === agent.id);
            if (member)
                return team;
        }
        return null;
    }
    // ── Session sync ─────────────────────────────────────────────────
    async syncSession(agentId, data) {
        return this.fetch(`/api/agents/${encodeURIComponent(agentId)}/sync-session`, { method: "POST", body: JSON.stringify(data) });
    }
}
//# sourceMappingURL=api-client.js.map