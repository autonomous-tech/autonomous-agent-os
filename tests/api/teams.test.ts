// =============================================================================
// Agent OS -- Team API Route Tests
// =============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getMockedPrisma, createRequest, parseResponse, cleanupDb } from "../helpers/db";

// Import route handlers
import { GET as listTeams, POST as createTeam } from "@/app/api/teams/route";
import { GET as getTeam, PATCH as updateTeam, DELETE as deleteTeam } from "@/app/api/teams/[id]/route";
import { GET as listMembers, POST as addMember, DELETE as removeMember } from "@/app/api/teams/[id]/members/route";
import { GET as listProjects, POST as createProject } from "@/app/api/teams/[id]/projects/route";

const mockTeam = {
  id: "team-1",
  name: "Test Team",
  slug: "test-team-abc",
  description: "A test team",
  status: "draft",
  orchestrationConfig: "{}",
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { members: 2, projects: 1 },
};

const mockMembership = {
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
    status: "draft",
  },
};

const mockProject = {
  id: "project-1",
  teamId: "team-1",
  name: "Test Project",
  brief: "A test project",
  status: "active",
  lettaBlockIds: "{}",
  activityLog: "[]",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const params = Promise.resolve({ id: "team-1" });

beforeEach(() => {
  cleanupDb();
});

// =============================================================================
// GET /api/teams
// =============================================================================

describe("/api/teams", () => {
  describe("GET /api/teams", () => {
    it("lists all teams with member and project counts", async () => {
      const mocked = getMockedPrisma();
      mocked.agentTeam.findMany.mockResolvedValue([mockTeam]);

      const response = await listTeams();
      const { status, body } = await parseResponse<unknown[]>(response);

      expect(status).toBe(200);
      expect(body).toHaveLength(1);
      expect((body[0] as Record<string, unknown>).name).toBe("Test Team");
      expect((body[0] as Record<string, unknown>).memberCount).toBe(2);
      expect((body[0] as Record<string, unknown>).projectCount).toBe(1);
    });
  });

  describe("POST /api/teams", () => {
    it("creates a new team", async () => {
      const mocked = getMockedPrisma();
      mocked.agentTeam.create.mockResolvedValue(mockTeam);

      const request = createRequest({ name: "Test Team", description: "A test team" });
      const response = await createTeam(request as NextRequest);
      const { status, body } = await parseResponse<Record<string, unknown>>(response);

      expect(status).toBe(201);
      expect(body.name).toBe("Test Team");
      expect(body.status).toBe("draft");
    });

    it("validates name is required", async () => {
      const request = createRequest({ description: "no name" });
      const response = await createTeam(request as NextRequest);
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(body.error).toContain("Name is required");
    });

    it("validates name length", async () => {
      const request = createRequest({ name: "x".repeat(101) });
      const response = await createTeam(request as NextRequest);
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(body.error).toContain("100 characters");
    });

    it("creates a team with initial members", async () => {
      const mocked = getMockedPrisma();
      mocked.agentProject.findMany.mockResolvedValue([{ id: "agent-1" }]);
      mocked.agentTeam.create.mockResolvedValue({ ...mockTeam, _count: { members: 1, projects: 0 } });

      const request = createRequest({ name: "Team", agentIds: ["agent-1"] });
      const response = await createTeam(request as NextRequest);
      const { status, body } = await parseResponse<Record<string, unknown>>(response);

      expect(status).toBe(201);
      expect(body.memberCount).toBe(1);
    });
  });
});

// =============================================================================
// GET/PATCH/DELETE /api/teams/[id]
// =============================================================================

describe("/api/teams/[id]", () => {
  describe("GET /api/teams/[id]", () => {
    it("returns team with members and projects", async () => {
      const mocked = getMockedPrisma();
      mocked.agentTeam.findUnique.mockResolvedValue({
        ...mockTeam,
        members: [mockMembership],
        projects: [mockProject],
      });

      const response = await getTeam(new NextRequest("http://test"), { params });
      const { status, body } = await parseResponse<Record<string, unknown>>(response);

      expect(status).toBe(200);
      expect(body.name).toBe("Test Team");
      expect(body.members).toHaveLength(1);
      expect(body.projects).toHaveLength(1);
    });

    it("returns 404 for nonexistent team", async () => {
      const mocked = getMockedPrisma();
      mocked.agentTeam.findUnique.mockResolvedValue(null);

      const response = await getTeam(new NextRequest("http://test"), { params });
      const { status } = await parseResponse(response);

      expect(status).toBe(404);
    });
  });

  describe("PATCH /api/teams/[id]", () => {
    it("updates team name", async () => {
      const mocked = getMockedPrisma();
      mocked.agentTeam.findUnique.mockResolvedValue(mockTeam);
      mocked.agentTeam.update.mockResolvedValue({ ...mockTeam, name: "New Name", orchestrationConfig: "{}" });

      const request = createRequest({ name: "New Name" });
      const response = await updateTeam(request as unknown as NextRequest, { params });
      const { status, body } = await parseResponse<Record<string, unknown>>(response);

      expect(status).toBe(200);
      expect(body.name).toBe("New Name");
    });

    it("merges orchestrationConfig", async () => {
      const mocked = getMockedPrisma();
      mocked.agentTeam.findUnique.mockResolvedValue(mockTeam);
      mocked.agentTeam.update.mockResolvedValue({
        ...mockTeam,
        orchestrationConfig: JSON.stringify({ mode: "sequential" }),
      });

      const request = createRequest({ orchestrationConfig: { mode: "sequential" } });
      const response = await updateTeam(request as unknown as NextRequest, { params });
      const { status, body } = await parseResponse<Record<string, unknown>>(response);

      expect(status).toBe(200);
      expect(body.orchestrationConfig).toEqual({ mode: "sequential" });
    });

    it("validates status values", async () => {
      const mocked = getMockedPrisma();
      mocked.agentTeam.findUnique.mockResolvedValue(mockTeam);

      const request = createRequest({ status: "invalid_status" });
      const response = await updateTeam(request as unknown as NextRequest, { params });
      const { status } = await parseResponse(response);

      expect(status).toBe(400);
    });

    it("rejects disallowed fields", async () => {
      const mocked = getMockedPrisma();
      mocked.agentTeam.findUnique.mockResolvedValue(mockTeam);

      const request = createRequest({ id: "hack", name: "Valid" });
      const response = await updateTeam(request as unknown as NextRequest, { params });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(body.error).toContain("not allowed");
    });
  });

  describe("DELETE /api/teams/[id]", () => {
    it("deletes a team", async () => {
      const mocked = getMockedPrisma();
      mocked.agentTeam.findUnique.mockResolvedValue(mockTeam);
      mocked.agentTeam.delete.mockResolvedValue(mockTeam);

      const response = await deleteTeam(new NextRequest("http://test"), { params });
      const { status, body } = await parseResponse<{ success: boolean }>(response);

      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });
  });
});

// =============================================================================
// GET/POST/DELETE /api/teams/[id]/members
// =============================================================================

describe("/api/teams/[id]/members", () => {
  it("lists team members with agent details", async () => {
    const mocked = getMockedPrisma();
    mocked.agentTeam.findUnique.mockResolvedValue(mockTeam);
    mocked.teamMembership.findMany.mockResolvedValue([mockMembership]);

    const response = await listMembers(new NextRequest("http://test"), { params });
    const { status, body } = await parseResponse<unknown[]>(response);

    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect((body[0] as Record<string, unknown>).agentName).toBe("Agent Alpha");
  });

  it("adds a member to the team", async () => {
    const mocked = getMockedPrisma();
    mocked.agentTeam.findUnique.mockResolvedValue(mockTeam);
    mocked.agentProject.findUnique.mockResolvedValue({ id: "agent-1", name: "Agent Alpha" });
    mocked.teamMembership.findUnique.mockResolvedValue(null); // no duplicate
    mocked.teamMembership.create.mockResolvedValue(mockMembership);

    const request = createRequest({ agentId: "agent-1", role: "member" });
    const response = await addMember(request as NextRequest, { params });
    const { status, body } = await parseResponse<Record<string, unknown>>(response);

    expect(status).toBe(201);
    expect(body.agentId).toBe("agent-1");
  });

  it("removes a member from the team", async () => {
    const mocked = getMockedPrisma();
    mocked.agentTeam.findUnique.mockResolvedValue(mockTeam);
    mocked.teamMembership.findUnique.mockResolvedValue(mockMembership);
    mocked.teamMembership.delete.mockResolvedValue(mockMembership);

    const request = createRequest("DELETE", "http://test", { agentId: "agent-1" });
    const response = await removeMember(request as NextRequest, { params });
    const { status, body } = await parseResponse<{ success: boolean }>(response);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// =============================================================================
// GET/POST /api/teams/[id]/projects
// =============================================================================

describe("/api/teams/[id]/projects", () => {
  it("lists team projects", async () => {
    const mocked = getMockedPrisma();
    mocked.agentTeam.findUnique.mockResolvedValue(mockTeam);
    mocked.teamProject.findMany.mockResolvedValue([mockProject]);

    const response = await listProjects(new NextRequest("http://test"), { params });
    const { status, body } = await parseResponse<unknown[]>(response);

    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect((body[0] as Record<string, unknown>).name).toBe("Test Project");
  });

  it("creates a project", async () => {
    const mocked = getMockedPrisma();
    mocked.agentTeam.findUnique.mockResolvedValue(mockTeam);
    mocked.teamProject.create.mockResolvedValue(mockProject);

    const request = createRequest({ name: "Test Project", brief: "A test project" });
    const response = await createProject(request as NextRequest, { params });
    const { status, body } = await parseResponse<Record<string, unknown>>(response);

    expect(status).toBe(201);
    expect(body.name).toBe("Test Project");
  });
});
