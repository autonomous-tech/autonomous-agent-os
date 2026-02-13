import { lettaClient, isLettaEnabled } from "./client";

/**
 * IDs of the shared memory blocks for a team project.
 */
export interface SharedBlockIds {
  project: string;
  decisions: string;
  taskBoard: string;
  brand: string;
}

/**
 * Snapshot of an agent's memory state for UI display.
 */
export interface MemorySnapshot {
  coreBlocks: Array<{ label: string; value: string; limit: number }>;
}

/**
 * Create the four shared memory blocks for a team project.
 * These blocks will be attached to all agents working on this project.
 *
 * Block architecture:
 * - `project`: Project name, brief, goals (read-only, 2000 chars)
 * - `decisions`: Key decisions, requirements, constraints (editable, 8000 chars)
 * - `task_board`: Current sprint tasks, blockers (editable, 6000 chars)
 * - `brand`: Brand guide, voice, design tokens (read-only, 10000 chars)
 *
 * @param projectName - Name of the project
 * @param projectBrief - Brief description of the project
 * @returns Object containing the four block IDs
 * @throws Error if Letta is not enabled or block creation fails
 */
export async function createSharedProjectBlocks(
  projectName: string,
  projectBrief: string
): Promise<SharedBlockIds> {
  if (!isLettaEnabled() || !lettaClient) {
    throw new Error("Letta is not enabled. Set LETTA_BASE_URL in .env");
  }

  try {
    // Create project block (read-only)
    const projectBlock = await lettaClient.blocks.create({
      label: "project",
      value: `# ${projectName}\n\n${projectBrief}\n\n---\nThis block contains the project overview and goals. It is read-only.`,
      limit: 2000,
      read_only: true,
      description: "Project overview and goals",
    });

    // Create decisions block (editable)
    const decisionsBlock = await lettaClient.blocks.create({
      label: "decisions",
      value: `# Project Decisions\n\nKey decisions, requirements, and constraints will be recorded here as the team works.\n\n---\nLast updated: ${new Date().toISOString()}`,
      limit: 8000,
      read_only: false,
      description: "Key project decisions and requirements",
    });

    // Create task board block (editable)
    const taskBoardBlock = await lettaClient.blocks.create({
      label: "task_board",
      value: `# Task Board\n\n## Current Sprint\n- [ ] Set up project structure\n- [ ] Define initial requirements\n\n## Blockers\nNone yet.\n\n---\nLast updated: ${new Date().toISOString()}`,
      limit: 6000,
      read_only: false,
      description: "Current tasks and blockers",
    });

    // Create brand block (read-only)
    const brandBlock = await lettaClient.blocks.create({
      label: "brand",
      value: `# Brand Guide\n\nBrand voice, visual identity, and design tokens will be defined here.\n\nFor now, follow standard best practices.\n\n---\nThis block is read-only. Load the brand guide skill for detailed guidance.`,
      limit: 10000,
      read_only: true,
      description: "Brand guide and design system",
    });

    return {
      project: projectBlock.id,
      decisions: decisionsBlock.id,
      taskBoard: taskBoardBlock.id,
      brand: brandBlock.id,
    };
  } catch (error) {
    throw new Error(
      `Failed to create shared project blocks: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Attach all shared blocks to a Letta agent.
 * This links the agent to the team's shared memory.
 *
 * @param lettaAgentId - The Letta agent ID
 * @param blockIds - IDs of the four shared blocks
 * @throws Error if Letta is not enabled or attachment fails
 */
export async function attachSharedBlocks(
  lettaAgentId: string,
  blockIds: SharedBlockIds
): Promise<void> {
  if (!isLettaEnabled() || !lettaClient) {
    throw new Error("Letta is not enabled. Set LETTA_BASE_URL in .env");
  }

  try {
    // Attach all four blocks to the agent
    await Promise.all([
      lettaClient.agents.blocks.attach(blockIds.project, {
        agent_id: lettaAgentId,
      }),
      lettaClient.agents.blocks.attach(blockIds.decisions, {
        agent_id: lettaAgentId,
      }),
      lettaClient.agents.blocks.attach(blockIds.taskBoard, {
        agent_id: lettaAgentId,
      }),
      lettaClient.agents.blocks.attach(blockIds.brand, {
        agent_id: lettaAgentId,
      }),
    ]);
  } catch (error) {
    throw new Error(
      `Failed to attach shared blocks to agent ${lettaAgentId}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Detach all shared blocks from a Letta agent.
 * Use this when switching a team member to a different project.
 *
 * @param lettaAgentId - The Letta agent ID
 * @param blockIds - IDs of the four shared blocks to detach
 * @throws Error if Letta is not enabled or detachment fails
 */
export async function detachSharedBlocks(
  lettaAgentId: string,
  blockIds: SharedBlockIds
): Promise<void> {
  if (!isLettaEnabled() || !lettaClient) {
    throw new Error("Letta is not enabled. Set LETTA_BASE_URL in .env");
  }

  try {
    // Detach all four blocks from the agent
    await Promise.all([
      lettaClient.agents.blocks.detach(blockIds.project, {
        agent_id: lettaAgentId,
      }),
      lettaClient.agents.blocks.detach(blockIds.decisions, {
        agent_id: lettaAgentId,
      }),
      lettaClient.agents.blocks.detach(blockIds.taskBoard, {
        agent_id: lettaAgentId,
      }),
      lettaClient.agents.blocks.detach(blockIds.brand, {
        agent_id: lettaAgentId,
      }),
    ]);
  } catch (error) {
    throw new Error(
      `Failed to detach shared blocks from agent ${lettaAgentId}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get a snapshot of all memory blocks for a Letta agent.
 * This is used to display the agent's current memory state in the UI.
 *
 * @param lettaAgentId - The Letta agent ID
 * @returns Memory snapshot containing all core blocks
 * @throws Error if Letta is not enabled or retrieval fails
 */
export async function getAgentMemorySnapshot(
  lettaAgentId: string
): Promise<MemorySnapshot> {
  if (!isLettaEnabled() || !lettaClient) {
    throw new Error("Letta is not enabled. Set LETTA_BASE_URL in .env");
  }

  try {
    // Get the agent details which include memory blocks
    const agent = await lettaClient.agents.retrieve(lettaAgentId);

    // Extract core memory blocks (filter out blocks without labels)
    const coreBlocks = (agent.memory?.blocks ?? [])
      .filter((block): block is typeof block & { label: string } => typeof block.label === "string")
      .map((block) => ({
        label: block.label,
        value: block.value,
        limit: block.limit ?? 0,
      }));

    return { coreBlocks };
  } catch (error) {
    throw new Error(
      `Failed to get memory snapshot for agent ${lettaAgentId}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Augment a system prompt with the agent's persistent memory from Letta.
 * Reads persona and scratchpad blocks and appends them to the prompt.
 *
 * Gracefully degrades: if Letta is unreachable, returns the original prompt.
 *
 * @param systemPrompt - The base system prompt
 * @param lettaAgentId - The Letta agent ID to read memory from
 * @returns The system prompt with memory appended
 */
export async function hydrateSystemPromptWithMemory(
  systemPrompt: string,
  lettaAgentId: string
): Promise<string> {
  try {
    if (!isLettaEnabled() || !lettaClient) {
      return systemPrompt;
    }

    const snapshot = await getAgentMemorySnapshot(lettaAgentId);

    if (snapshot.coreBlocks.length === 0) {
      return systemPrompt;
    }

    const memorySection = snapshot.coreBlocks
      .map((block) => `### ${block.label}\n${block.value}`)
      .join("\n\n");

    return `${systemPrompt}\n\n## Your Persistent Memory\n\n${memorySection}`;
  } catch (error) {
    console.error(
      "[memory] Failed to hydrate system prompt with memory (non-blocking):",
      error instanceof Error ? error.message : error
    );
    return systemPrompt;
  }
}
