// =============================================================================
// Agent OS -- API Tests: Team Deploy + MCP Server Test
// =============================================================================
// Route 1: POST /api/teams/[id]/deploy
//   Source: src/app/api/teams/[id]/deploy/route.ts
//
// Route 2: POST /api/agents/[id]/mcp-servers/[serverId]/test
//   Source: src/app/api/agents/[id]/mcp-servers/[serverId]/test/route.ts
// =============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  getMockedPrisma,
  createTestAgent,
  cleanupDb,
  createRequest,
  parseResponse,
} from "../helpers/db";
import { sampleAgentConfig } from "../helpers/fixtures";

// ---------------------------------------------------------------------------
// Hoisted mock functions (available before vi.mock factories execute)
// ---------------------------------------------------------------------------

const {
  mockLettaCreate,
  mockConnect,
  mockIsConnected,
  mockListTools,
  mockDisconnect,
} = vi.hoisted(() => ({
  mockLettaCreate: vi.fn(),
  mockConnect: vi.fn(),
  mockIsConnected: vi.fn().mockReturnValue(true),
  mockListTools: vi.fn().mockResolvedValue([
    { name: "tool_1", description: "A tool", serverName: "test-server" },
  ]),
  mockDisconnect: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock Letta modules (for deploy route)
// ---------------------------------------------------------------------------

vi.mock("@/lib/letta/client", () => ({
  isLettaEnabled: vi.fn().mockReturnValue(true),
  lettaClient: {
    agents: {
      create: mockLettaCreate,
    },
  },
}));

vi.mock("@/lib/letta/translate", () => ({
  translateToLettaParams: vi.fn().mockReturnValue({
    name: "Test Agent",
    description: "desc",
    system: "system prompt",
    model: "anthropic/claude-sonnet-4-5-20250929",
    embedding: "openai/text-embedding-3-small",
    memoryBlocks: [{ label: "persona", value: "I am helpful", limit: 5000 }],
  }),
  buildMemoryCategorizationPrompt: vi
    .fn()
    .mockReturnValue("Memory categorization prompt"),
}));

vi.mock("@/lib/letta/memory", () => ({
  attachSharedBlocks: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Mock MCP modules (for mcp-server test route)
// ---------------------------------------------------------------------------

vi.mock("@/lib/runtime/mcp-client", () => ({
  McpClientManager: vi.fn().mockImplementation(function () {
    return {
      connect: mockConnect,
      isConnected: mockIsConnected,
      listTools: mockListTools,
      disconnect: mockDisconnect,
    };
  }),
}));

vi.mock("@/lib/mcp-helpers", () => ({
  rowToDefinition: vi.fn().mockReturnValue({
    name: "test-server",
    transport: "stdio",
    command: "npx",
    args: ["-y", "test-server"],
  }),
}));

// ---------------------------------------------------------------------------
// Import route handlers (must come after vi.mock calls)
// ---------------------------------------------------------------------------

import { POST as deployTeam } from "@/app/api/teams/[id]/deploy/route";
import { POST as testMcpServer } from "@/app/api/agents/[id]/mcp-servers/[serverId]/test/route";
import { isLettaEnabled } from "@/lib/letta/client";
import { attachSharedBlocks } from "@/lib/letta/memory";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

function makeMockTeam(overrides: Record<string, unknown> = {}) {
  return {
    id: "team-1",
    name: "Test Team",
    slug: "test-team-abc",
    description: "A test team",
    status: "draft",
    orchestrationConfig: "{}",
    createdAt: new Date(),
    updatedAt: new Date(),
    members: [],
    projects: [],
    ...overrides,
  };
}

function makeMockMember(overrides: Record<string, unknown> = {}) {
  return {
    id: "membership-1",
    teamId: "team-1",
    agentId: "agent-1",
    role: "member",
    lettaAgentId: null,
    createdAt: new Date(),
    agent: {
      id: "agent-1",
      name: "Agent Alpha",
      slug: "agent-alpha",
      description: "Test agent",
      status: "exported",
      config: JSON.stringify(sampleAgentConfig),
      lettaAgentId: null,
    },
    ...overrides,
  };
}

function makeMockProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-1",
    teamId: "team-1",
    name: "Test Project",
    brief: "A test project",
    status: "active",
    lettaBlockIds: "{}",
    activityLog: "[]",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function mockServerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "server-1",
    agentId: "agent-1",
    name: "test-server",
    transport: "stdio",
    command: "npx",
    url: null,
    args: JSON.stringify(["-y", "test-server"]),
    env: JSON.stringify({}),
    allowedTools: JSON.stringify([]),
    blockedTools: JSON.stringify([]),
    sandboxConfig: JSON.stringify({}),
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// =============================================================================
// POST /api/teams/[id]/deploy
// =============================================================================

describe("POST /api/teams/[id]/deploy", () => {
  beforeEach(() => {
    cleanupDb();
    mockLettaCreate.mockReset();
    mockLettaCreate.mockResolvedValue({ id: "letta-agent-123" });
    vi.mocked(isLettaEnabled).mockReturnValue(true);
    vi.mocked(attachSharedBlocks).mockReset();
    vi.mocked(attachSharedBlocks).mockResolvedValue(undefined);
  });

  const teamParams = Promise.resolve({ id: "team-1" });

  it("returns 400 when Letta is not enabled", async () => {
    vi.mocked(isLettaEnabled).mockReturnValue(false);

    const request = new NextRequest("http://test/api/teams/team-1/deploy", {
      method: "POST",
    });
    const response = await deployTeam(request, { params: teamParams });
    const { status, body } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(400);
    expect(body.error).toMatch(/Letta is not enabled/i);
  });

  it("returns 404 for nonexistent team", async () => {
    const mocked = getMockedPrisma();
    mocked.agentTeam.findUnique.mockResolvedValue(null);

    const request = new NextRequest("http://test/api/teams/team-1/deploy", {
      method: "POST",
    });
    const response = await deployTeam(request, { params: teamParams });
    const { status, body } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("deploys all undeployed members and updates team status to active", async () => {
    const mocked = getMockedPrisma();

    const member1 = makeMockMember({
      id: "membership-1",
      agentId: "agent-1",
      lettaAgentId: null,
      agent: {
        id: "agent-1",
        name: "Agent Alpha",
        config: JSON.stringify(sampleAgentConfig),
        lettaAgentId: null,
      },
    });
    const member2 = makeMockMember({
      id: "membership-2",
      agentId: "agent-2",
      lettaAgentId: null,
      agent: {
        id: "agent-2",
        name: "Agent Beta",
        config: JSON.stringify(sampleAgentConfig),
        lettaAgentId: null,
      },
    });

    const team = makeMockTeam({
      members: [member1, member2],
      projects: [],
    });

    mocked.agentTeam.findUnique.mockResolvedValue(team);
    mocked.teamMembership.update.mockResolvedValue({});
    mocked.agentProject.update.mockResolvedValue({});
    mocked.agentTeam.update.mockResolvedValue({ ...team, status: "active" });

    mockLettaCreate
      .mockResolvedValueOnce({ id: "letta-1" })
      .mockResolvedValueOnce({ id: "letta-2" });

    const request = new NextRequest("http://test/api/teams/team-1/deploy", {
      method: "POST",
    });
    const response = await deployTeam(request, { params: teamParams });
    const { status, body } = await parseResponse<{
      teamId: string;
      deployedCount: number;
      skippedCount: number;
      failedCount: number;
      results: Array<{ agentId: string; status: string; lettaAgentId: string | null }>;
    }>(response);

    expect(status).toBe(200);
    expect(body.deployedCount).toBe(2);
    expect(body.skippedCount).toBe(0);
    expect(body.failedCount).toBe(0);
    expect(body.results).toHaveLength(2);
    expect(body.results[0].status).toBe("deployed");
    expect(body.results[1].status).toBe("deployed");
    expect(body.results[0].lettaAgentId).toBe("letta-1");
    expect(body.results[1].lettaAgentId).toBe("letta-2");

    // Verify team status was updated to active
    expect(mocked.agentTeam.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "team-1" },
        data: { status: "active" },
      })
    );

    // Verify membership records were updated with letta agent IDs
    expect(mocked.teamMembership.update).toHaveBeenCalledTimes(2);

    // Verify agent projects were updated with letta agent IDs
    expect(mocked.agentProject.update).toHaveBeenCalledTimes(2);
  });

  it("skips already-deployed members (member.lettaAgentId already set)", async () => {
    const mocked = getMockedPrisma();

    const deployedMember = makeMockMember({
      id: "membership-1",
      agentId: "agent-1",
      lettaAgentId: "already-deployed-letta-id",
      agent: {
        id: "agent-1",
        name: "Agent Alpha",
        config: JSON.stringify(sampleAgentConfig),
        lettaAgentId: "already-deployed-letta-id",
      },
    });
    const undeployedMember = makeMockMember({
      id: "membership-2",
      agentId: "agent-2",
      lettaAgentId: null,
      agent: {
        id: "agent-2",
        name: "Agent Beta",
        config: JSON.stringify(sampleAgentConfig),
        lettaAgentId: null,
      },
    });

    const team = makeMockTeam({
      members: [deployedMember, undeployedMember],
      projects: [],
    });

    mocked.agentTeam.findUnique.mockResolvedValue(team);
    mocked.teamMembership.update.mockResolvedValue({});
    mocked.agentProject.update.mockResolvedValue({});
    mocked.agentTeam.update.mockResolvedValue({ ...team, status: "active" });

    mockLettaCreate.mockResolvedValueOnce({ id: "letta-new" });

    const request = new NextRequest("http://test/api/teams/team-1/deploy", {
      method: "POST",
    });
    const response = await deployTeam(request, { params: teamParams });
    const { status, body } = await parseResponse<{
      deployedCount: number;
      skippedCount: number;
      failedCount: number;
      results: Array<{ agentId: string; status: string; lettaAgentId: string | null }>;
    }>(response);

    expect(status).toBe(200);
    expect(body.deployedCount).toBe(1);
    expect(body.skippedCount).toBe(1);
    expect(body.failedCount).toBe(0);

    // The skipped member should retain its existing lettaAgentId
    const skippedResult = body.results.find((r) => r.agentId === "agent-1");
    expect(skippedResult).toBeDefined();
    expect(skippedResult!.status).toBe("skipped");
    expect(skippedResult!.lettaAgentId).toBe("already-deployed-letta-id");

    // The deployed member should have the new letta ID
    const deployedResult = body.results.find((r) => r.agentId === "agent-2");
    expect(deployedResult).toBeDefined();
    expect(deployedResult!.status).toBe("deployed");
    expect(deployedResult!.lettaAgentId).toBe("letta-new");

    // Letta create should only be called once (for the undeployed member)
    expect(mockLettaCreate).toHaveBeenCalledTimes(1);
  });

  it("attaches shared blocks if active project has block IDs", async () => {
    const mocked = getMockedPrisma();

    const member = makeMockMember({
      lettaAgentId: null,
      agent: {
        id: "agent-1",
        name: "Agent Alpha",
        config: JSON.stringify(sampleAgentConfig),
        lettaAgentId: null,
      },
    });

    const sharedBlockIds = {
      project: "block-project",
      decisions: "block-decisions",
      taskBoard: "block-taskboard",
      brand: "block-brand",
    };

    const projectWithBlocks = makeMockProject({
      status: "active",
      lettaBlockIds: JSON.stringify(sharedBlockIds),
    });

    const team = makeMockTeam({
      members: [member],
      projects: [projectWithBlocks],
    });

    mocked.agentTeam.findUnique.mockResolvedValue(team);
    mocked.teamMembership.update.mockResolvedValue({});
    mocked.agentProject.update.mockResolvedValue({});
    mocked.agentTeam.update.mockResolvedValue({ ...team, status: "active" });

    mockLettaCreate.mockResolvedValueOnce({ id: "letta-deployed-1" });

    const request = new NextRequest("http://test/api/teams/team-1/deploy", {
      method: "POST",
    });
    const response = await deployTeam(request, { params: teamParams });
    const { status, body } = await parseResponse<{
      blocksAttached: number;
      deployedCount: number;
    }>(response);

    expect(status).toBe(200);
    expect(body.deployedCount).toBe(1);
    expect(body.blocksAttached).toBe(1);

    // Verify attachSharedBlocks was called with the correct arguments
    expect(attachSharedBlocks).toHaveBeenCalledWith(
      "letta-deployed-1",
      sharedBlockIds
    );
  });

  it("returns proper result counts (deployed, skipped, failed)", async () => {
    const mocked = getMockedPrisma();

    const member1 = makeMockMember({
      id: "m-1",
      agentId: "a-1",
      lettaAgentId: null,
      agent: {
        id: "a-1",
        name: "Deploy Success",
        config: JSON.stringify(sampleAgentConfig),
        lettaAgentId: null,
      },
    });
    const member2 = makeMockMember({
      id: "m-2",
      agentId: "a-2",
      lettaAgentId: "existing-letta",
      agent: {
        id: "a-2",
        name: "Already Deployed",
        config: JSON.stringify(sampleAgentConfig),
        lettaAgentId: "existing-letta",
      },
    });
    const member3 = makeMockMember({
      id: "m-3",
      agentId: "a-3",
      lettaAgentId: null,
      agent: {
        id: "a-3",
        name: "Deploy Fail",
        config: JSON.stringify(sampleAgentConfig),
        lettaAgentId: null,
      },
    });

    const team = makeMockTeam({
      members: [member1, member2, member3],
      projects: [],
    });

    mocked.agentTeam.findUnique.mockResolvedValue(team);
    mocked.teamMembership.update.mockResolvedValue({});
    mocked.agentProject.update.mockResolvedValue({});
    mocked.agentTeam.update.mockResolvedValue({ ...team, status: "active" });

    // First call succeeds, second call (for member3) fails by returning null from deploy
    mockLettaCreate
      .mockResolvedValueOnce({ id: "letta-success" })
      .mockRejectedValueOnce(new Error("Letta API error"));

    const request = new NextRequest("http://test/api/teams/team-1/deploy", {
      method: "POST",
    });
    const response = await deployTeam(request, { params: teamParams });
    const { status, body } = await parseResponse<{
      teamId: string;
      teamName: string;
      deployedCount: number;
      skippedCount: number;
      failedCount: number;
      results: Array<{
        agentId: string;
        agentName: string;
        status: string;
        lettaAgentId: string | null;
        error?: string;
      }>;
    }>(response);

    expect(status).toBe(200);
    expect(body.teamId).toBe("team-1");
    expect(body.teamName).toBe("Test Team");
    expect(body.deployedCount).toBe(1);
    expect(body.skippedCount).toBe(1);
    expect(body.failedCount).toBe(1);

    // Verify individual results
    const deployed = body.results.find((r) => r.agentId === "a-1");
    expect(deployed!.status).toBe("deployed");
    expect(deployed!.lettaAgentId).toBe("letta-success");

    const skipped = body.results.find((r) => r.agentId === "a-2");
    expect(skipped!.status).toBe("skipped");
    expect(skipped!.lettaAgentId).toBe("existing-letta");

    const failed = body.results.find((r) => r.agentId === "a-3");
    expect(failed!.status).toBe("failed");
    expect(failed!.lettaAgentId).toBeNull();
    expect(failed!.error).toBeDefined();
  });
});

// =============================================================================
// POST /api/agents/[id]/mcp-servers/[serverId]/test
// =============================================================================

describe("POST /api/agents/[id]/mcp-servers/[serverId]/test", () => {
  const AGENT_ID = "agent-1";
  const SERVER_ID = "server-1";

  beforeEach(() => {
    cleanupDb();
    mockConnect.mockReset();
    mockConnect.mockResolvedValue(undefined);
    mockIsConnected.mockReset();
    mockIsConnected.mockReturnValue(true);
    mockListTools.mockReset();
    mockListTools.mockResolvedValue([
      { name: "tool_1", description: "A tool", serverName: "test-server" },
    ]);
    mockDisconnect.mockReset();
    mockDisconnect.mockResolvedValue(undefined);
  });

  const mcpParams = Promise.resolve({ id: AGENT_ID, serverId: SERVER_ID });

  it("returns 404 for nonexistent agent", async () => {
    // Default mock returns null for findUnique -- agent not found
    const request = new NextRequest("http://test", { method: "POST" });
    const response = await testMcpServer(request, { params: mcpParams });
    const { status, body } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 404 for nonexistent MCP server", async () => {
    createTestAgent({ id: AGENT_ID });
    const mocked = getMockedPrisma();
    // Agent exists, but MCP server lookup returns null
    mocked.mcpServerConfig.findUnique.mockResolvedValue(null);

    const request = new NextRequest("http://test", { method: "POST" });
    const response = await testMcpServer(request, { params: mcpParams });
    const { status, body } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 404 when server belongs to a different agent", async () => {
    createTestAgent({ id: AGENT_ID });
    const mocked = getMockedPrisma();

    // Server exists but belongs to a different agent
    const serverForOtherAgent = mockServerRow({ agentId: "other-agent-id" });
    mocked.mcpServerConfig.findUnique.mockResolvedValue(serverForOtherAgent);

    const request = new NextRequest("http://test", { method: "POST" });
    const response = await testMcpServer(request, { params: mcpParams });
    const { status, body } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns connected=true with tools list on success", async () => {
    createTestAgent({ id: AGENT_ID });
    const mocked = getMockedPrisma();

    const server = mockServerRow({ agentId: AGENT_ID });
    mocked.mcpServerConfig.findUnique.mockResolvedValue(server);

    const request = new NextRequest("http://test", { method: "POST" });
    const response = await testMcpServer(request, { params: mcpParams });
    const { status, body } = await parseResponse<{
      connected: boolean;
      tools: Array<{ name: string; description: string; serverName: string }>;
    }>(response);

    expect(status).toBe(200);
    expect(body.connected).toBe(true);
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].name).toBe("tool_1");
    expect(body.tools[0].description).toBe("A tool");
    expect(body.tools[0].serverName).toBe("test-server");

    // Verify connect was called
    expect(mockConnect).toHaveBeenCalledTimes(1);

    // Verify disconnect was called for cleanup
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it("returns connected=false when connection fails (connect throws)", async () => {
    createTestAgent({ id: AGENT_ID });
    const mocked = getMockedPrisma();

    const server = mockServerRow({ agentId: AGENT_ID });
    mocked.mcpServerConfig.findUnique.mockResolvedValue(server);

    // Simulate connection failure
    mockConnect.mockRejectedValueOnce(new Error("Connection refused"));

    const request = new NextRequest("http://test", { method: "POST" });
    const response = await testMcpServer(request, { params: mcpParams });
    const { status, body } = await parseResponse<{
      connected: boolean;
      error: string;
    }>(response);

    expect(status).toBe(200);
    expect(body.connected).toBe(false);
    expect(body.error).toBeDefined();
  });

  it("returns connected=false when isConnected returns false", async () => {
    createTestAgent({ id: AGENT_ID });
    const mocked = getMockedPrisma();

    const server = mockServerRow({ agentId: AGENT_ID });
    mocked.mcpServerConfig.findUnique.mockResolvedValue(server);

    // connect() succeeds but isConnected returns false
    mockIsConnected.mockReturnValue(false);

    const request = new NextRequest("http://test", { method: "POST" });
    const response = await testMcpServer(request, { params: mcpParams });
    const { status, body } = await parseResponse<{
      connected: boolean;
      error: string;
    }>(response);

    expect(status).toBe(200);
    expect(body.connected).toBe(false);
    expect(body.error).toMatch(/did not connect/i);
  });

  it("cleans up (disconnects) even on failure", async () => {
    createTestAgent({ id: AGENT_ID });
    const mocked = getMockedPrisma();

    const server = mockServerRow({ agentId: AGENT_ID });
    mocked.mcpServerConfig.findUnique.mockResolvedValue(server);

    // connect succeeds but listTools throws (after connect, so manager exists)
    mockListTools.mockRejectedValueOnce(new Error("Tool listing failed"));

    const request = new NextRequest("http://test", { method: "POST" });
    const response = await testMcpServer(request, { params: mcpParams });
    const { status, body } = await parseResponse<{
      connected: boolean;
      error: string;
    }>(response);

    expect(status).toBe(200);
    expect(body.connected).toBe(false);

    // Verify disconnect was called for cleanup even though an error occurred
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
