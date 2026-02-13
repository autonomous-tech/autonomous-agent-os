import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/runtime/prompt", () => ({
  buildRuntimeSystemPrompt: vi.fn().mockReturnValue("System prompt for runtime"),
}));

import {
  translateToLettaParams,
  buildMemoryCategorizationPrompt,
} from "@/lib/letta/translate";
import type { AgentConfig } from "@/lib/types";

describe("translateToLettaParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear env vars that could affect defaults
    delete process.env.LETTA_DEFAULT_MODEL;
    delete process.env.LETTA_DEFAULT_EMBEDDING;
  });

  it("returns correct name and description from args and mission config", () => {
    const config: AgentConfig = {
      mission: { description: "Help users write code" },
    };

    const result = translateToLettaParams("CodeBot", config);

    expect(result.name).toBe("CodeBot");
    expect(result.description).toBe("Help users write code");
  });

  it("returns empty description when mission.description is not set", () => {
    const config: AgentConfig = {};

    const result = translateToLettaParams("EmptyBot", config);

    expect(result.description).toBe("");
  });

  it("returns default model and embedding when env vars are not set", () => {
    const config: AgentConfig = {};

    const result = translateToLettaParams("TestBot", config);

    expect(result.model).toBe("anthropic/claude-sonnet-4-5-20250929");
    expect(result.embedding).toBe("openai/text-embedding-3-small");
  });

  it("uses env vars for model and embedding when set", () => {
    process.env.LETTA_DEFAULT_MODEL = "custom/model-v1";
    process.env.LETTA_DEFAULT_EMBEDDING = "custom/embed-v1";

    const config: AgentConfig = {};

    const result = translateToLettaParams("TestBot", config);

    expect(result.model).toBe("custom/model-v1");
    expect(result.embedding).toBe("custom/embed-v1");
  });

  it("uses mocked buildRuntimeSystemPrompt for the system field", () => {
    const config: AgentConfig = {};

    const result = translateToLettaParams("TestBot", config);

    expect(result.system).toBe("System prompt for runtime");
  });

  it("builds persona block from identity and mission config", () => {
    const config: AgentConfig = {
      identity: {
        name: "Rex",
        vibe: "Energetic and curious",
        tone: "casual",
      },
      mission: {
        description: "Help with research",
        tasks: ["Search papers", "Summarize findings"],
        exclusions: ["Write code", "Do math"],
      },
      guardrails: {
        behavioral: ["Always cite sources", "Never fabricate data"],
      },
    };

    const result = translateToLettaParams("Rex", config);

    const personaBlock = result.memoryBlocks.find(
      (b) => b.label === "persona"
    );
    expect(personaBlock).toBeDefined();
    expect(personaBlock!.value).toContain("My name is Rex.");
    expect(personaBlock!.value).toContain("Personality: Energetic and curious");
    expect(personaBlock!.value).toContain("Tone: casual");
    expect(personaBlock!.value).toContain("Mission: Help with research");
    expect(personaBlock!.value).toContain(
      "Key tasks: Search papers, Summarize findings"
    );
    expect(personaBlock!.value).toContain(
      "I do NOT: Write code, Do math"
    );
    expect(personaBlock!.value).toContain(
      "Behavioral rules: Always cite sources; Never fabricate data"
    );
    expect(personaBlock!.limit).toBe(5000);
  });

  it("builds scratchpad block with placeholder text", () => {
    const config: AgentConfig = {};

    const result = translateToLettaParams("TestBot", config);

    const scratchpad = result.memoryBlocks.find(
      (b) => b.label === "scratchpad"
    );
    expect(scratchpad).toBeDefined();
    expect(scratchpad!.value).toBe(
      "Working notes and current task context will go here."
    );
    expect(scratchpad!.limit).toBe(5000);
  });

  it("adds memory_instructions block when config.memory.remember is set", () => {
    const config: AgentConfig = {
      memory: {
        remember: ["User preferences", "Project context", "Deadlines"],
      },
    };

    const result = translateToLettaParams("MemBot", config);

    const memoryBlock = result.memoryBlocks.find(
      (b) => b.label === "memory_instructions"
    );
    expect(memoryBlock).toBeDefined();
    expect(memoryBlock!.value).toContain(
      "Things I should remember about the user:"
    );
    expect(memoryBlock!.value).toContain("- User preferences");
    expect(memoryBlock!.value).toContain("- Project context");
    expect(memoryBlock!.value).toContain("- Deadlines");
    expect(memoryBlock!.limit).toBe(3000);
    expect(memoryBlock!.readOnly).toBe(true);
  });

  it("does not add memory_instructions block when remember is empty", () => {
    const config: AgentConfig = {
      memory: { remember: [] },
    };

    const result = translateToLettaParams("TestBot", config);

    const memoryBlock = result.memoryBlocks.find(
      (b) => b.label === "memory_instructions"
    );
    expect(memoryBlock).toBeUndefined();
  });

  it("does not add memory_instructions block when memory is not set", () => {
    const config: AgentConfig = {};

    const result = translateToLettaParams("TestBot", config);

    const memoryBlock = result.memoryBlocks.find(
      (b) => b.label === "memory_instructions"
    );
    expect(memoryBlock).toBeUndefined();
  });

  it("returns minimal persona for empty config", () => {
    const config: AgentConfig = {};

    const result = translateToLettaParams("Empty", config);

    const personaBlock = result.memoryBlocks.find(
      (b) => b.label === "persona"
    );
    expect(personaBlock).toBeDefined();
    expect(personaBlock!.value).toBe("I am a helpful AI assistant.");
  });

  it("always includes exactly persona and scratchpad blocks for empty config", () => {
    const config: AgentConfig = {};

    const result = translateToLettaParams("Empty", config);

    expect(result.memoryBlocks).toHaveLength(2);
    expect(result.memoryBlocks.map((b) => b.label)).toEqual([
      "persona",
      "scratchpad",
    ]);
  });

  it("includes 3 blocks when memory.remember is provided", () => {
    const config: AgentConfig = {
      memory: { remember: ["preferences"] },
    };

    const result = translateToLettaParams("TestBot", config);

    expect(result.memoryBlocks).toHaveLength(3);
    expect(result.memoryBlocks.map((b) => b.label)).toEqual([
      "persona",
      "scratchpad",
      "memory_instructions",
    ]);
  });
});

describe("buildMemoryCategorizationPrompt", () => {
  it("returns a string", () => {
    const result = buildMemoryCategorizationPrompt();
    expect(typeof result).toBe("string");
  });

  it("contains key phrase 'About THIS project'", () => {
    const result = buildMemoryCategorizationPrompt();
    expect(result).toContain("About THIS project");
  });

  it("contains key phrase 'About the USER\\'s preferences'", () => {
    const result = buildMemoryCategorizationPrompt();
    expect(result).toContain("About the USER's preferences");
  });

  it("contains key phrase 'About your craft'", () => {
    const result = buildMemoryCategorizationPrompt();
    expect(result).toContain("About your craft");
  });

  it("contains Memory Management heading", () => {
    const result = buildMemoryCategorizationPrompt();
    expect(result).toContain("## Memory Management");
  });

  it("mentions core_memory_replace and archival_memory_insert", () => {
    const result = buildMemoryCategorizationPrompt();
    expect(result).toContain("core_memory_replace");
    expect(result).toContain("archival_memory_insert");
  });
});
