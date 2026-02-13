import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// ── Mock Letta client (inline vi.fn — avoids vi.hoisted TDZ issue) ──
vi.mock("@/lib/letta/client", () => ({
  isLettaEnabled: vi.fn().mockReturnValue(true),
  lettaClient: {
    blocks: {
      create: vi.fn(),
    },
    agents: {
      retrieve: vi.fn(),
      create: vi.fn(),
      blocks: {
        attach: vi.fn(),
        detach: vi.fn(),
      },
      passages: {
        create: vi.fn(),
      },
    },
  },
}));

// ── Mock translate and runtime/prompt for teams.ts ─────────────────
vi.mock("@/lib/letta/translate", () => ({
  translateToLettaParams: vi.fn().mockReturnValue({
    name: "Test Agent",
    description: "desc",
    system: "system",
    model: "anthropic/claude-sonnet-4-5-20250929",
    embedding: "openai/text-embedding-3-small",
    memoryBlocks: [{ label: "persona", value: "test", limit: 5000 }],
  }),
  buildMemoryCategorizationPrompt: vi
    .fn()
    .mockReturnValue("categorization prompt"),
}));

vi.mock("@/lib/runtime/prompt", () => ({
  buildRuntimeSystemPrompt: vi.fn().mockReturnValue("system prompt"),
}));

// ── Mock fs/promises for skills.ts ─────────────────────────────────
vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    readdir: vi.fn(),
  },
}));

// ── Imports (after vi.mock) ─────────────────────────────────────────
import { lettaClient, isLettaEnabled } from "@/lib/letta/client";

import {
  createSharedProjectBlocks,
  attachSharedBlocks,
  detachSharedBlocks,
  getAgentMemorySnapshot,
} from "@/lib/letta/memory";
import type { SharedBlockIds } from "@/lib/letta/memory";

import { loadSkillToArchival, loadSkillsDirectory } from "@/lib/letta/skills";

import {
  deployTeamToLetta,
  setupProjectMemory,
  attachProjectToTeam,
  detachProjectFromTeam,
  loadTeamSkills,
} from "@/lib/letta/teams";

import fs from "fs/promises";

// ── Extract mock references via the mocked module ───────────────────
const mockIsLettaEnabled = isLettaEnabled as unknown as Mock;
const mockBlocksCreate = lettaClient!.blocks.create as unknown as Mock;
const mockBlocksAttach = (lettaClient as any).agents.blocks.attach as Mock;
const mockBlocksDetach = (lettaClient as any).agents.blocks.detach as Mock;
const mockAgentsRetrieve = (lettaClient as any).agents.retrieve as Mock;
const mockAgentsCreate = (lettaClient as any).agents.create as Mock;
const mockPassagesCreate = (lettaClient as any).agents.passages.create as Mock;

// ====================================================================
// memory.ts tests
// ====================================================================

describe("memory.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLettaEnabled.mockReturnValue(true);
  });

  describe("createSharedProjectBlocks", () => {
    it("creates 4 blocks with correct labels and returns their IDs", async () => {
      mockBlocksCreate
        .mockResolvedValueOnce({ id: "block-project" })
        .mockResolvedValueOnce({ id: "block-decisions" })
        .mockResolvedValueOnce({ id: "block-taskboard" })
        .mockResolvedValueOnce({ id: "block-brand" });

      const result = await createSharedProjectBlocks(
        "MyProject",
        "A test project"
      );

      expect(mockBlocksCreate).toHaveBeenCalledTimes(4);

      // Check each block was created with correct label
      expect(mockBlocksCreate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ label: "project", read_only: true, limit: 2000 })
      );
      expect(mockBlocksCreate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ label: "decisions", read_only: false, limit: 8000 })
      );
      expect(mockBlocksCreate).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ label: "task_board", read_only: false, limit: 6000 })
      );
      expect(mockBlocksCreate).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({ label: "brand", read_only: true, limit: 10000 })
      );

      // Check returned IDs
      expect(result).toEqual({
        project: "block-project",
        decisions: "block-decisions",
        taskBoard: "block-taskboard",
        brand: "block-brand",
      });
    });

    it("includes project name and brief in the project block value", async () => {
      mockBlocksCreate.mockResolvedValue({ id: "block-xxx" });

      await createSharedProjectBlocks("Alpha", "Build a rocket");

      const firstCall = mockBlocksCreate.mock.calls[0][0];
      expect(firstCall.value).toContain("# Alpha");
      expect(firstCall.value).toContain("Build a rocket");
    });

    it("throws when Letta is not enabled", async () => {
      mockIsLettaEnabled.mockReturnValue(false);

      await expect(
        createSharedProjectBlocks("Test", "Brief")
      ).rejects.toThrow("Letta is not enabled");
    });

    it("wraps client errors in a descriptive message", async () => {
      mockBlocksCreate.mockRejectedValueOnce(new Error("Connection refused"));

      await expect(
        createSharedProjectBlocks("Test", "Brief")
      ).rejects.toThrow("Failed to create shared project blocks: Connection refused");
    });
  });

  describe("attachSharedBlocks", () => {
    const blockIds: SharedBlockIds = {
      project: "bp-1",
      decisions: "bd-1",
      taskBoard: "bt-1",
      brand: "bb-1",
    };

    it("calls attach for all 4 blocks", async () => {
      mockBlocksAttach.mockResolvedValue(undefined);

      await attachSharedBlocks("agent-123", blockIds);

      expect(mockBlocksAttach).toHaveBeenCalledTimes(4);
      expect(mockBlocksAttach).toHaveBeenCalledWith("bp-1", {
        agent_id: "agent-123",
      });
      expect(mockBlocksAttach).toHaveBeenCalledWith("bd-1", {
        agent_id: "agent-123",
      });
      expect(mockBlocksAttach).toHaveBeenCalledWith("bt-1", {
        agent_id: "agent-123",
      });
      expect(mockBlocksAttach).toHaveBeenCalledWith("bb-1", {
        agent_id: "agent-123",
      });
    });

    it("throws when Letta is not enabled", async () => {
      mockIsLettaEnabled.mockReturnValue(false);

      await expect(
        attachSharedBlocks("agent-123", blockIds)
      ).rejects.toThrow("Letta is not enabled");
    });

    it("wraps client errors in a descriptive message", async () => {
      mockBlocksAttach.mockRejectedValueOnce(new Error("Not found"));

      await expect(
        attachSharedBlocks("agent-123", blockIds)
      ).rejects.toThrow("Failed to attach shared blocks to agent agent-123");
    });
  });

  describe("detachSharedBlocks", () => {
    const blockIds: SharedBlockIds = {
      project: "bp-1",
      decisions: "bd-1",
      taskBoard: "bt-1",
      brand: "bb-1",
    };

    it("calls detach for all 4 blocks", async () => {
      mockBlocksDetach.mockResolvedValue(undefined);

      await detachSharedBlocks("agent-456", blockIds);

      expect(mockBlocksDetach).toHaveBeenCalledTimes(4);
      expect(mockBlocksDetach).toHaveBeenCalledWith("bp-1", {
        agent_id: "agent-456",
      });
      expect(mockBlocksDetach).toHaveBeenCalledWith("bd-1", {
        agent_id: "agent-456",
      });
      expect(mockBlocksDetach).toHaveBeenCalledWith("bt-1", {
        agent_id: "agent-456",
      });
      expect(mockBlocksDetach).toHaveBeenCalledWith("bb-1", {
        agent_id: "agent-456",
      });
    });

    it("throws when Letta is not enabled", async () => {
      mockIsLettaEnabled.mockReturnValue(false);

      await expect(
        detachSharedBlocks("agent-456", blockIds)
      ).rejects.toThrow("Letta is not enabled");
    });

    it("wraps client errors in a descriptive message", async () => {
      mockBlocksDetach.mockRejectedValueOnce(new Error("Timeout"));

      await expect(
        detachSharedBlocks("agent-456", blockIds)
      ).rejects.toThrow("Failed to detach shared blocks from agent agent-456");
    });
  });

  describe("getAgentMemorySnapshot", () => {
    it("returns core blocks from agent.memory.blocks", async () => {
      mockAgentsRetrieve.mockResolvedValueOnce({
        memory: {
          blocks: [
            { label: "persona", value: "I am Rex.", limit: 5000 },
            { label: "scratchpad", value: "Current task...", limit: 5000 },
            { label: "project", value: "# Alpha", limit: 2000 },
          ],
        },
      });

      const result = await getAgentMemorySnapshot("agent-789");

      expect(mockAgentsRetrieve).toHaveBeenCalledWith("agent-789");
      expect(result.coreBlocks).toHaveLength(3);
      expect(result.coreBlocks).toEqual([
        { label: "persona", value: "I am Rex.", limit: 5000 },
        { label: "scratchpad", value: "Current task...", limit: 5000 },
        { label: "project", value: "# Alpha", limit: 2000 },
      ]);
    });

    it("filters out blocks without labels", async () => {
      mockAgentsRetrieve.mockResolvedValueOnce({
        memory: {
          blocks: [
            { label: "persona", value: "test", limit: 5000 },
            { value: "orphan block with no label", limit: 1000 },
            { label: null, value: "null label", limit: 500 },
          ],
        },
      });

      const result = await getAgentMemorySnapshot("agent-789");

      expect(result.coreBlocks).toHaveLength(1);
      expect(result.coreBlocks[0].label).toBe("persona");
    });

    it("returns empty coreBlocks when agent has no memory blocks", async () => {
      mockAgentsRetrieve.mockResolvedValueOnce({
        memory: { blocks: [] },
      });

      const result = await getAgentMemorySnapshot("agent-789");

      expect(result.coreBlocks).toEqual([]);
    });

    it("handles agent with no memory field gracefully", async () => {
      mockAgentsRetrieve.mockResolvedValueOnce({});

      const result = await getAgentMemorySnapshot("agent-789");

      expect(result.coreBlocks).toEqual([]);
    });

    it("defaults limit to 0 when block.limit is not provided", async () => {
      mockAgentsRetrieve.mockResolvedValueOnce({
        memory: {
          blocks: [{ label: "persona", value: "test" }],
        },
      });

      const result = await getAgentMemorySnapshot("agent-789");

      expect(result.coreBlocks[0].limit).toBe(0);
    });

    it("throws when Letta is not enabled", async () => {
      mockIsLettaEnabled.mockReturnValue(false);

      await expect(getAgentMemorySnapshot("agent-789")).rejects.toThrow(
        "Letta is not enabled"
      );
    });
  });
});

// ====================================================================
// skills.ts tests
// ====================================================================

describe("skills.ts", () => {
  const mockedFs = vi.mocked(fs);

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLettaEnabled.mockReturnValue(true);
  });

  describe("loadSkillToArchival", () => {
    it("reads file, chunks content, and inserts passages with tags", async () => {
      const skillContent =
        "# My Skill\n\nThis is a skill description.\n\nIt has multiple paragraphs.";

      mockedFs.readFile.mockResolvedValueOnce(skillContent);
      mockPassagesCreate.mockResolvedValue({});

      const result = await loadSkillToArchival(
        "agent-100",
        "/skills/my-skill/SKILL.md"
      );

      expect(mockedFs.readFile).toHaveBeenCalledWith(
        "/skills/my-skill/SKILL.md",
        "utf-8"
      );
      expect(mockPassagesCreate).toHaveBeenCalled();

      // Each passage should be called with the agent ID and contain tags
      const firstCall = mockPassagesCreate.mock.calls[0];
      expect(firstCall[0]).toBe("agent-100");
      expect(firstCall[1].tags).toContain("my-skill");
      expect(firstCall[1].tags).toContain("skill");
      expect(firstCall[1].text).toContain("[SKILL: my-skill]");

      expect(result.chunks).toBeGreaterThan(0);
    });

    it("creates multiple chunks for large content", async () => {
      // Create content that is large enough to require multiple chunks
      const paragraph = "This is a reasonably long paragraph. ".repeat(20);
      const largContent = `# Big Skill\n\n${paragraph}\n\n${paragraph}\n\n${paragraph}`;

      mockedFs.readFile.mockResolvedValueOnce(largContent);
      mockPassagesCreate.mockResolvedValue({});

      const result = await loadSkillToArchival(
        "agent-100",
        "/skills/big-skill/SKILL.md"
      );

      expect(result.chunks).toBeGreaterThan(1);
      expect(mockPassagesCreate).toHaveBeenCalledTimes(result.chunks);
    });

    it("throws on empty file", async () => {
      mockedFs.readFile.mockResolvedValueOnce("");

      await expect(
        loadSkillToArchival("agent-100", "/skills/empty/SKILL.md")
      ).rejects.toThrow("Skill file is empty");
    });

    it("throws on whitespace-only file", async () => {
      mockedFs.readFile.mockResolvedValueOnce("   \n\n  ");

      await expect(
        loadSkillToArchival("agent-100", "/skills/blank/SKILL.md")
      ).rejects.toThrow("Skill file is empty");
    });

    it("throws on file not found (ENOENT)", async () => {
      const enoentError = Object.assign(new Error("ENOENT"), {
        code: "ENOENT",
      });
      mockedFs.readFile.mockRejectedValueOnce(enoentError);

      await expect(
        loadSkillToArchival("agent-100", "/skills/missing/SKILL.md")
      ).rejects.toThrow("Skill file not found: /skills/missing/SKILL.md");
    });

    it("throws when Letta is not enabled", async () => {
      mockIsLettaEnabled.mockReturnValue(false);

      await expect(
        loadSkillToArchival("agent-100", "/skills/any/SKILL.md")
      ).rejects.toThrow("Letta is not enabled");
    });
  });

  describe("loadSkillsDirectory", () => {
    it("finds SKILL.md files recursively and loads each", async () => {
      // Mock readdir for the top-level directory
      mockedFs.readdir.mockResolvedValueOnce([
        { name: "skill-a", isDirectory: () => true, isFile: () => false },
        { name: "skill-b", isDirectory: () => true, isFile: () => false },
        { name: "README.md", isDirectory: () => false, isFile: () => true },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      // Mock readdir for skill-a subdirectory
      mockedFs.readdir.mockResolvedValueOnce([
        { name: "SKILL.md", isDirectory: () => false, isFile: () => true },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      // Mock readdir for skill-b subdirectory
      mockedFs.readdir.mockResolvedValueOnce([
        { name: "SKILL.md", isDirectory: () => false, isFile: () => true },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      // Mock readFile for each SKILL.md
      mockedFs.readFile
        .mockResolvedValueOnce("# Skill A\n\nContent for skill A.")
        .mockResolvedValueOnce("# Skill B\n\nContent for skill B.");

      mockPassagesCreate.mockResolvedValue({});

      const result = await loadSkillsDirectory("agent-200", "/skills");

      expect(result.loaded).toHaveLength(2);
      expect(result.loaded).toContain("skill-a");
      expect(result.loaded).toContain("skill-b");
      expect(result.errors).toHaveLength(0);
    });

    it("returns empty loaded with error message when no SKILL.md files found", async () => {
      // Mock readdir returning no SKILL.md files
      mockedFs.readdir.mockResolvedValueOnce([
        { name: "README.md", isDirectory: () => false, isFile: () => true },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      const result = await loadSkillsDirectory("agent-200", "/skills/empty");

      expect(result.loaded).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("No SKILL.md files found");
    });

    it("continues loading when individual files fail", async () => {
      // Mock readdir
      mockedFs.readdir.mockResolvedValueOnce([
        { name: "good-skill", isDirectory: () => true, isFile: () => false },
        { name: "bad-skill", isDirectory: () => true, isFile: () => false },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      mockedFs.readdir.mockResolvedValueOnce([
        { name: "SKILL.md", isDirectory: () => false, isFile: () => true },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      mockedFs.readdir.mockResolvedValueOnce([
        { name: "SKILL.md", isDirectory: () => false, isFile: () => true },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      // First file reads fine, second is empty (will cause an error)
      mockedFs.readFile
        .mockResolvedValueOnce("# Good Skill\n\nSome content here.")
        .mockResolvedValueOnce("");

      mockPassagesCreate.mockResolvedValue({});

      const result = await loadSkillsDirectory("agent-200", "/skills");

      expect(result.loaded).toContain("good-skill");
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("bad-skill");
    });

    it("throws when Letta is not enabled", async () => {
      mockIsLettaEnabled.mockReturnValue(false);

      await expect(
        loadSkillsDirectory("agent-200", "/skills")
      ).rejects.toThrow("Letta is not enabled");
    });
  });
});

// ====================================================================
// teams.ts tests
// ====================================================================

describe("teams.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLettaEnabled.mockReturnValue(true);
  });

  describe("deployTeamToLetta", () => {
    it("deploys undeployed members and creates Letta agents", async () => {
      mockAgentsCreate.mockResolvedValueOnce({ id: "letta-agent-1" });

      const team = {
        members: [
          {
            agentId: "agent-1",
            lettaAgentId: null,
            agent: {
              name: "Builder",
              config: JSON.stringify({
                mission: { description: "Build things" },
              }),
            },
          },
        ],
      };

      const results = await deployTeamToLetta(team);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("deployed");
      expect(results[0].lettaAgentId).toBe("letta-agent-1");
      expect(results[0].agentName).toBe("Builder");
      expect(mockAgentsCreate).toHaveBeenCalledTimes(1);

      // Verify the system prompt includes categorization prompt
      const createCall = mockAgentsCreate.mock.calls[0][0];
      expect(createCall.system).toContain("categorization prompt");
    });

    it("skips already-deployed members", async () => {
      const team = {
        members: [
          {
            agentId: "agent-2",
            lettaAgentId: "letta-existing",
            agent: {
              name: "Deployed Agent",
              config: JSON.stringify({}),
            },
          },
        ],
      };

      const results = await deployTeamToLetta(team);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("skipped");
      expect(results[0].lettaAgentId).toBe("letta-existing");
      expect(mockAgentsCreate).not.toHaveBeenCalled();
    });

    it("handles a mix of deployed and undeployed members", async () => {
      mockAgentsCreate.mockResolvedValueOnce({ id: "letta-new" });

      const team = {
        members: [
          {
            agentId: "agent-deployed",
            lettaAgentId: "letta-old",
            agent: { name: "Old", config: JSON.stringify({}) },
          },
          {
            agentId: "agent-new",
            lettaAgentId: null,
            agent: {
              name: "New",
              config: JSON.stringify({ mission: { description: "New mission" } }),
            },
          },
        ],
      };

      const results = await deployTeamToLetta(team);

      expect(results).toHaveLength(2);
      const skipped = results.find((r) => r.status === "skipped");
      const deployed = results.find((r) => r.status === "deployed");
      expect(skipped).toBeDefined();
      expect(skipped!.agentId).toBe("agent-deployed");
      expect(deployed).toBeDefined();
      expect(deployed!.lettaAgentId).toBe("letta-new");
    });

    it("returns failed status when agent creation throws", async () => {
      mockAgentsCreate.mockRejectedValueOnce(new Error("API down"));

      const team = {
        members: [
          {
            agentId: "agent-fail",
            lettaAgentId: null,
            agent: {
              name: "FailBot",
              config: JSON.stringify({}),
            },
          },
        ],
      };

      const results = await deployTeamToLetta(team);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("failed");
      expect(results[0].lettaAgentId).toBeNull();
      expect(results[0].error).toContain("Failed to deploy agent");
      expect(results[0].error).toContain("API down");
    });

    it("throws when Letta is not enabled", async () => {
      mockIsLettaEnabled.mockReturnValue(false);

      await expect(
        deployTeamToLetta({ members: [] })
      ).rejects.toThrow("Letta is not enabled");
    });
  });

  describe("setupProjectMemory", () => {
    it("delegates to createSharedProjectBlocks", async () => {
      mockBlocksCreate
        .mockResolvedValueOnce({ id: "b-p" })
        .mockResolvedValueOnce({ id: "b-d" })
        .mockResolvedValueOnce({ id: "b-t" })
        .mockResolvedValueOnce({ id: "b-b" });

      const result = await setupProjectMemory("ProjectX", "A brief");

      expect(mockBlocksCreate).toHaveBeenCalledTimes(4);
      expect(result).toEqual({
        project: "b-p",
        decisions: "b-d",
        taskBoard: "b-t",
        brand: "b-b",
      });
    });

    it("throws when Letta is not enabled", async () => {
      mockIsLettaEnabled.mockReturnValue(false);

      await expect(
        setupProjectMemory("Test", "Brief")
      ).rejects.toThrow("Letta is not enabled");
    });

    it("wraps errors from createSharedProjectBlocks", async () => {
      mockBlocksCreate.mockRejectedValueOnce(new Error("Disk full"));

      await expect(
        setupProjectMemory("Test", "Brief")
      ).rejects.toThrow('Failed to set up project memory for "Test"');
    });
  });

  describe("attachProjectToTeam", () => {
    const blockIds: SharedBlockIds = {
      project: "bp-1",
      decisions: "bd-1",
      taskBoard: "bt-1",
      brand: "bb-1",
    };

    it("attaches blocks to all agents in parallel", async () => {
      mockBlocksAttach.mockResolvedValue(undefined);

      await attachProjectToTeam(["letta-a", "letta-b", "letta-c"], blockIds);

      // 3 agents x 4 blocks = 12 attach calls
      expect(mockBlocksAttach).toHaveBeenCalledTimes(12);

      // Verify each agent got all 4 blocks attached
      for (const agentId of ["letta-a", "letta-b", "letta-c"]) {
        expect(mockBlocksAttach).toHaveBeenCalledWith("bp-1", {
          agent_id: agentId,
        });
        expect(mockBlocksAttach).toHaveBeenCalledWith("bd-1", {
          agent_id: agentId,
        });
        expect(mockBlocksAttach).toHaveBeenCalledWith("bt-1", {
          agent_id: agentId,
        });
        expect(mockBlocksAttach).toHaveBeenCalledWith("bb-1", {
          agent_id: agentId,
        });
      }
    });

    it("throws when Letta is not enabled", async () => {
      mockIsLettaEnabled.mockReturnValue(false);

      await expect(
        attachProjectToTeam(["letta-a"], blockIds)
      ).rejects.toThrow("Letta is not enabled");
    });

    it("wraps errors from attachSharedBlocks", async () => {
      mockBlocksAttach.mockRejectedValueOnce(new Error("Agent not found"));

      await expect(
        attachProjectToTeam(["letta-a"], blockIds)
      ).rejects.toThrow("Failed to attach project memory to team");
    });
  });

  describe("detachProjectFromTeam", () => {
    const blockIds: SharedBlockIds = {
      project: "bp-1",
      decisions: "bd-1",
      taskBoard: "bt-1",
      brand: "bb-1",
    };

    it("detaches blocks from all agents", async () => {
      mockBlocksDetach.mockResolvedValue(undefined);

      await detachProjectFromTeam(["letta-x", "letta-y"], blockIds);

      // 2 agents x 4 blocks = 8 detach calls
      expect(mockBlocksDetach).toHaveBeenCalledTimes(8);

      for (const agentId of ["letta-x", "letta-y"]) {
        expect(mockBlocksDetach).toHaveBeenCalledWith("bp-1", {
          agent_id: agentId,
        });
        expect(mockBlocksDetach).toHaveBeenCalledWith("bd-1", {
          agent_id: agentId,
        });
        expect(mockBlocksDetach).toHaveBeenCalledWith("bt-1", {
          agent_id: agentId,
        });
        expect(mockBlocksDetach).toHaveBeenCalledWith("bb-1", {
          agent_id: agentId,
        });
      }
    });

    it("throws when Letta is not enabled", async () => {
      mockIsLettaEnabled.mockReturnValue(false);

      await expect(
        detachProjectFromTeam(["letta-x"], blockIds)
      ).rejects.toThrow("Letta is not enabled");
    });

    it("wraps errors from detachSharedBlocks", async () => {
      mockBlocksDetach.mockRejectedValueOnce(new Error("Timeout"));

      await expect(
        detachProjectFromTeam(["letta-x"], blockIds)
      ).rejects.toThrow("Failed to detach project memory from team");
    });
  });

  describe("loadTeamSkills", () => {
    it("loads skills for all agents", async () => {
      const mockedFs = vi.mocked(
        (await import("fs/promises")).default
      );

      // Both agents call loadSkillsDirectory in parallel, so use
      // mockImplementation to handle both calls correctly.
      mockedFs.readdir.mockImplementation(async (dirPath: unknown) => {
        const p = String(dirPath);
        if (p === "/skills") {
          return [
            { name: "skill-x", isDirectory: () => true, isFile: () => false },
          ] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
        }
        // subdirectory: /skills/skill-x
        return [
          { name: "SKILL.md", isDirectory: () => false, isFile: () => true },
        ] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
      });

      mockedFs.readFile.mockResolvedValue("# Skill X\n\nContent X.");
      mockPassagesCreate.mockResolvedValue({});

      const results = await loadTeamSkills(
        ["letta-1", "letta-2"],
        "/skills"
      );

      expect(results).toHaveLength(2);
      expect(results[0].loaded).toContain("skill-x");
      expect(results[1].loaded).toContain("skill-x");
    });

    it("throws when Letta is not enabled", async () => {
      mockIsLettaEnabled.mockReturnValue(false);

      await expect(
        loadTeamSkills(["letta-1"], "/skills")
      ).rejects.toThrow("Letta is not enabled");
    });
  });
});
