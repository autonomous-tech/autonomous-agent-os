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

import fs from "fs/promises";

// ── Extract mock references via the mocked module ───────────────────
const mockIsLettaEnabled = isLettaEnabled as unknown as Mock;
const mockBlocksCreate = lettaClient!.blocks.create as unknown as Mock;
const mockBlocksAttach = (lettaClient as any).agents.blocks.attach as Mock;
const mockBlocksDetach = (lettaClient as any).agents.blocks.detach as Mock;
const mockAgentsRetrieve = (lettaClient as any).agents.retrieve as Mock;
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
