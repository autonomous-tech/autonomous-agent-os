import type { AgentConfig } from "@/lib/types";
import { buildRuntimeSystemPrompt } from "@/lib/runtime/prompt";

/**
 * Memory block definitions for a Letta agent derived from an AgentConfig.
 */
export interface LettaMemoryBlock {
  label: string;
  value: string;
  limit?: number;
  readOnly?: boolean;
}

/**
 * Parameters needed to create a Letta agent from our AgentConfig.
 */
export interface LettaAgentParams {
  name: string;
  description: string;
  system: string;
  memoryBlocks: LettaMemoryBlock[];
  model: string;
  embedding: string;
}

/** Build the persona block content from identity + mission config. */
function buildPersonaBlock(config: AgentConfig): string {
  const lines: string[] = [];

  if (config.identity?.name) {
    lines.push(`My name is ${config.identity.name}.`);
  }
  if (config.identity?.vibe) {
    lines.push(`Personality: ${config.identity.vibe}`);
  }
  if (config.identity?.tone) {
    lines.push(`Tone: ${config.identity.tone}`);
  }
  if (config.mission?.description) {
    lines.push(`Mission: ${config.mission.description}`);
  }
  if (config.mission?.tasks?.length) {
    lines.push(`Key tasks: ${config.mission.tasks.join(", ")}`);
  }
  if (config.mission?.exclusions?.length) {
    lines.push(`I do NOT: ${config.mission.exclusions.join(", ")}`);
  }
  if (config.guardrails?.behavioral?.length) {
    lines.push(`Behavioral rules: ${config.guardrails.behavioral.join("; ")}`);
  }

  return lines.length > 0
    ? lines.join("\n")
    : "I am a helpful AI assistant.";
}

/** Build the scratchpad block — starts empty, agent fills it over time. */
function buildScratchpadBlock(): string {
  return "Working notes and current task context will go here.";
}

/**
 * Translate an AgentConfig into parameters for creating a Letta agent.
 * This is a pure function — it doesn't call any APIs.
 */
export function translateToLettaParams(
  agentName: string,
  config: AgentConfig
): LettaAgentParams {
  const system = buildRuntimeSystemPrompt(config);

  const memoryBlocks: LettaMemoryBlock[] = [
    {
      label: "persona",
      value: buildPersonaBlock(config),
      limit: 5000,
    },
    {
      label: "scratchpad",
      value: buildScratchpadBlock(),
      limit: 5000,
    },
  ];

  // Add memory config hints
  if (config.memory?.remember?.length) {
    const memoryHints = config.memory.remember.join("\n- ");
    memoryBlocks.push({
      label: "memory_instructions",
      value: `Things I should remember about the user:\n- ${memoryHints}`,
      limit: 3000,
      readOnly: true,
    });
  }

  return {
    name: agentName,
    description: config.mission?.description ?? "",
    system,
    memoryBlocks,
    model: process.env.LETTA_DEFAULT_MODEL ?? "anthropic/claude-sonnet-4-5-20250929",
    embedding: process.env.LETTA_DEFAULT_EMBEDDING ?? "openai/text-embedding-3-small",
  };
}

