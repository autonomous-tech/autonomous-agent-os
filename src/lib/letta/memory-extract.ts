import { chat } from "@/lib/claude";
import { lettaClient, isLettaEnabled } from "@/lib/letta/client";
import type { AgentConfig } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────

export interface CategorizedLearnings {
  persona: string[];
  decisions: string[];
  archival: string[];
}

// ── Extract memory from session summary ──────────────────────────────

const CATEGORIZATION_PROMPT = `You are a memory categorization engine. Given a session summary from an AI agent's conversation, extract key learnings and categorize them.

Return ONLY valid JSON (no markdown, no code fences) with this structure:
{
  "persona": ["items about the user's preferences, working style, communication preferences"],
  "decisions": ["project-specific facts, decisions made, requirements agreed upon"],
  "archival": ["reusable knowledge, patterns, techniques, general learnings"]
}

Rules:
- Each item should be a concise, self-contained statement
- Skip trivial or obvious information
- If a category has no items, return an empty array
- Keep each item under 200 characters`;

export async function extractMemoryFromSession(
  summary: string,
  config: AgentConfig
): Promise<CategorizedLearnings> {
  const agentName = config.identity?.name || "Agent";
  const userMessage = `Agent: ${agentName}\nSession summary:\n${summary}`;

  const response = await chat(CATEGORIZATION_PROMPT, [
    { role: "user", content: userMessage },
  ]);

  try {
    let jsonStr = response.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```(?:json)?\n?/g, "").trim();
    }
    const parsed = JSON.parse(jsonStr);
    return {
      persona: Array.isArray(parsed.persona) ? parsed.persona : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      archival: Array.isArray(parsed.archival) ? parsed.archival : [],
    };
  } catch (error) {
    console.warn(
      "[memory-extract] Failed to parse categorization response:",
      error,
      "Raw (first 300 chars):",
      response.slice(0, 300)
    );
    return { persona: [], decisions: [], archival: [] };
  }
}

// ── Persist extracted memory to Letta ────────────────────────────────

export async function persistExtractedMemory(
  lettaAgentId: string,
  learnings: CategorizedLearnings
): Promise<void> {
  if (!isLettaEnabled() || !lettaClient) {
    throw new Error("Letta is not enabled");
  }

  const MAX_BLOCK_LENGTH = 10000;

  async function appendToBlock(label: string, items: string[], silent = false): Promise<void> {
    if (items.length === 0) return;
    try {
      const block = await lettaClient!.agents.blocks.retrieve(label, {
        agent_id: lettaAgentId,
      });
      const newValue = block.value + items.map((l) => `\n${l}`).join("");
      if (newValue.length <= MAX_BLOCK_LENGTH) {
        await lettaClient!.agents.blocks.update(label, {
          agent_id: lettaAgentId,
          value: newValue,
        });
      } else {
        console.warn(`[memory-extract] ${label} block would exceed ${MAX_BLOCK_LENGTH} chars (${newValue.length}), skipping ${items.length} items`);
      }
    } catch (error) {
      if (!silent) {
        console.error(`[memory-extract] Failed to update ${label} block:`, error);
      }
    }
  }

  await appendToBlock("persona", learnings.persona);
  // Decisions block may not exist for solo agents — skip silently
  await appendToBlock("decisions", learnings.decisions, true);

  for (const learning of learnings.archival) {
    try {
      await lettaClient.agents.passages.create(lettaAgentId, {
        text: learning,
        tags: ["session-extract"],
      });
    } catch (error) {
      console.error("[memory-extract] Failed to insert archival:", error);
    }
  }
}

// ── Combined: extract + persist ──────────────────────────────────────

export async function syncSessionMemory(
  lettaAgentId: string,
  summary: string,
  config: AgentConfig
): Promise<CategorizedLearnings> {
  const learnings = await extractMemoryFromSession(summary, config);

  const hasLearnings = [learnings.persona, learnings.decisions, learnings.archival]
    .some((items) => items.length > 0);

  if (hasLearnings) {
    await persistExtractedMemory(lettaAgentId, learnings);
  }

  return learnings;
}
