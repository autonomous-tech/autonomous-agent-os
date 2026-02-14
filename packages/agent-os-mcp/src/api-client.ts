export interface AgentInfo {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  config: Record<string, unknown>;
  lettaAgentId: string | null;
}

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

export class AgentOsApiClient {
  constructor(
    private baseUrl: string,
    private agentSlug: string
  ) {}

  private async fetch(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  }

  async getAgentBySlug(): Promise<AgentInfo> {
    const res = await this.fetch(`/api/agents/by-slug/${this.agentSlug}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch agent: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<AgentInfo>;
  }

  async getMemoryBlocks(lettaAgentId: string): Promise<MemoryBlock[]> {
    const res = await this.fetch(`/api/letta/agents/${lettaAgentId}/memory`);
    if (!res.ok) {
      throw new Error(`Failed to fetch memory blocks: ${res.status}`);
    }
    const data = (await res.json()) as { blocks: MemoryBlock[] };
    return data.blocks;
  }

  async getMemoryBlock(
    lettaAgentId: string,
    label: string
  ): Promise<MemoryBlock> {
    const res = await this.fetch(
      `/api/letta/agents/${lettaAgentId}/memory/${label}`
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch block '${label}': ${res.status}`);
    }
    return res.json() as Promise<MemoryBlock>;
  }

  async updateMemoryBlock(
    lettaAgentId: string,
    label: string,
    value: string
  ): Promise<MemoryBlock> {
    const res = await this.fetch(
      `/api/letta/agents/${lettaAgentId}/memory/${label}`,
      {
        method: "PUT",
        body: JSON.stringify({ value }),
      }
    );
    if (!res.ok) {
      let errorMsg = `Failed to update block: ${res.status}`;
      try {
        const error = (await res.json()) as { error: string };
        errorMsg = error.error || errorMsg;
      } catch { /* response was not JSON */ }
      throw new Error(errorMsg);
    }
    return res.json() as Promise<MemoryBlock>;
  }

  async searchArchival(
    lettaAgentId: string,
    query: string
  ): Promise<ArchivalPassage[]> {
    const res = await this.fetch(
      `/api/letta/agents/${lettaAgentId}/archival?q=${encodeURIComponent(query)}`
    );
    if (!res.ok) {
      throw new Error(`Failed to search archival: ${res.status}`);
    }
    const data = (await res.json()) as { passages: ArchivalPassage[] };
    return data.passages;
  }

  async insertArchival(
    lettaAgentId: string,
    text: string
  ): Promise<void> {
    const res = await this.fetch(
      `/api/letta/agents/${lettaAgentId}/archival`,
      {
        method: "POST",
        body: JSON.stringify({ text }),
      }
    );
    if (!res.ok) {
      throw new Error(`Failed to insert archival: ${res.status}`);
    }
  }

  async syncSession(
    agentId: string,
    summary: string
  ): Promise<{ success: boolean }> {
    const res = await this.fetch(`/api/agents/${agentId}/sync-session`, {
      method: "POST",
      body: JSON.stringify({ summary }),
    });
    if (!res.ok) {
      throw new Error(`Failed to sync session: ${res.status}`);
    }
    return res.json() as Promise<{ success: boolean }>;
  }
}
