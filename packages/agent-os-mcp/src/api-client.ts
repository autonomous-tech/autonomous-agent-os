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
    agent: { name: string; slug: string; description: string };
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

export class AgentOsClient {
  private baseUrl: string;

  constructor(config: McpConfig) {
    this.baseUrl = config.baseUrl;
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
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

    return res.json() as Promise<T>;
  }

  async getAgentBySlug(slug: string): Promise<AgentInfo> {
    return this.fetch<AgentInfo>(`/api/agents/by-slug/${encodeURIComponent(slug)}`);
  }

  async getMemoryBlocks(lettaId: string): Promise<MemoryBlock[]> {
    const res = await this.fetch<{ blocks: MemoryBlock[] }>(
      `/api/letta/agents/${encodeURIComponent(lettaId)}/memory`
    );
    return res.blocks;
  }

  async getMemoryBlock(lettaId: string, label: string): Promise<MemoryBlock> {
    return this.fetch<MemoryBlock>(
      `/api/letta/agents/${encodeURIComponent(lettaId)}/memory/${encodeURIComponent(label)}`
    );
  }

  async updateMemoryBlock(lettaId: string, label: string, value: string): Promise<MemoryBlock> {
    return this.fetch<MemoryBlock>(
      `/api/letta/agents/${encodeURIComponent(lettaId)}/memory/${encodeURIComponent(label)}`,
      { method: "PUT", body: JSON.stringify({ value }) }
    );
  }

  async searchArchival(
    lettaId: string,
    query: string
  ): Promise<{ passages: ArchivalPassage[]; count?: number }> {
    return this.fetch(
      `/api/letta/agents/${encodeURIComponent(lettaId)}/archival?q=${encodeURIComponent(query)}`
    );
  }

  async insertArchival(
    lettaId: string,
    text: string,
    tags?: string[]
  ): Promise<{ passages: unknown }> {
    return this.fetch(
      `/api/letta/agents/${encodeURIComponent(lettaId)}/archival`,
      { method: "POST", body: JSON.stringify(tags ? { text, tags } : { text }) }
    );
  }

  async getTeamForAgent(agentSlug: string): Promise<TeamInfo | null> {
    const agent = await this.getAgentBySlug(agentSlug);
    const teams = await this.fetch<TeamInfo[]>("/api/teams");
    return teams.find((t) => t.members?.some((m) => m.agentId === agent.id)) ?? null;
  }

  async syncSession(
    agentId: string,
    data: { summary: string; decisions?: string[]; preferences?: string[]; knowledge?: string[]; taskUpdates?: string[] }
  ): Promise<SyncSessionResult> {
    return this.fetch<SyncSessionResult>(
      `/api/agents/${encodeURIComponent(agentId)}/sync-session`,
      { method: "POST", body: JSON.stringify(data) }
    );
  }
}
