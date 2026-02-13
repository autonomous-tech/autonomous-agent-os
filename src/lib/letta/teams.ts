import { lettaClient, isLettaEnabled } from "./client";
import { translateToLettaParams, buildMemoryCategorizationPrompt } from "./translate";
import {
  createSharedProjectBlocks,
  attachSharedBlocks,
  detachSharedBlocks,
} from "./memory";
import type { SharedBlockIds } from "./memory";
import { loadSkillsDirectory } from "./skills";
import type { BulkSkillLoadResult } from "./skills";
import type { AgentConfig } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────

export interface TeamMember {
  agentId: string;
  lettaAgentId: string | null;
  agent: { name: string; config: string };
}

export interface TeamDeployResult {
  agentId: string;
  agentName: string;
  lettaAgentId: string | null;
  status: "deployed" | "failed" | "skipped";
  error?: string;
}

interface Team {
  members: TeamMember[];
  activeProject?: { name: string; brief: string } | null;
}

// ── Helpers ────────────────────────────────────────────────────────

function ensureLettaAvailable(): void {
  if (!isLettaEnabled() || !lettaClient) {
    throw new Error("Letta is not enabled. Set LETTA_BASE_URL in .env");
  }
}

// ── Exported functions ─────────────────────────────────────────────

/**
 * Deploy all undeployed team members to Letta.
 *
 * For each member that does not already have a `lettaAgentId`, translates
 * the agent config into Letta params, appends the memory categorization
 * prompt to the system message, and creates a Letta agent.
 *
 * Members that already have a `lettaAgentId` are skipped.
 *
 * @param team - Team object containing members and an optional active project
 * @returns Array of deploy results (one per member)
 * @throws Error if Letta is not enabled
 */
export async function deployTeamToLetta(
  team: Team
): Promise<TeamDeployResult[]> {
  ensureLettaAvailable();

  const memoryCategorizationPrompt = buildMemoryCategorizationPrompt();

  const results = await Promise.all(
    team.members.map(async (member): Promise<TeamDeployResult> => {
      // Skip members that are already deployed
      if (member.lettaAgentId) {
        return {
          agentId: member.agentId,
          agentName: member.agent.name,
          lettaAgentId: member.lettaAgentId,
          status: "skipped",
        };
      }

      try {
        const config: AgentConfig = JSON.parse(member.agent.config);
        const params = translateToLettaParams(member.agent.name, config);

        // Append memory categorization instructions to the system prompt
        const system = `${params.system}\n\n${memoryCategorizationPrompt}`;

        const lettaAgent = await lettaClient!.agents.create({
          name: params.name,
          description: params.description,
          system,
          model: params.model,
          embedding: params.embedding,
          memory_blocks: params.memoryBlocks.map((block) => ({
            label: block.label,
            value: block.value,
            limit: block.limit ?? 5000,
          })),
        });

        return {
          agentId: member.agentId,
          agentName: member.agent.name,
          lettaAgentId: lettaAgent.id,
          status: "deployed",
        };
      } catch (error) {
        return {
          agentId: member.agentId,
          agentName: member.agent.name,
          lettaAgentId: null,
          status: "failed",
          error: `Failed to deploy agent "${member.agent.name}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    })
  );

  return results;
}

/**
 * Create shared memory blocks for a team project.
 *
 * This creates four shared blocks (project, decisions, task_board, brand)
 * that can be attached to all agents working on the project.
 *
 * @param projectName - Name of the project
 * @param brief - Brief description of the project
 * @returns IDs of the four shared memory blocks
 * @throws Error if Letta is not enabled or block creation fails
 */
export async function setupProjectMemory(
  projectName: string,
  brief: string
): Promise<SharedBlockIds> {
  ensureLettaAvailable();

  try {
    return await createSharedProjectBlocks(projectName, brief);
  } catch (error) {
    throw new Error(
      `Failed to set up project memory for "${projectName}": ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Attach shared project memory blocks to all team agents.
 *
 * @param memberLettaIds - Array of Letta agent IDs for each team member
 * @param blockIds - IDs of the four shared memory blocks
 * @throws Error if Letta is not enabled or attachment fails for any agent
 */
export async function attachProjectToTeam(
  memberLettaIds: string[],
  blockIds: SharedBlockIds
): Promise<void> {
  ensureLettaAvailable();

  try {
    await Promise.all(
      memberLettaIds.map((lettaAgentId) =>
        attachSharedBlocks(lettaAgentId, blockIds)
      )
    );
  } catch (error) {
    throw new Error(
      `Failed to attach project memory to team: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Detach shared project memory blocks from all team agents.
 *
 * Use this when switching team members to a different project or
 * when tearing down a project.
 *
 * @param memberLettaIds - Array of Letta agent IDs for each team member
 * @param blockIds - IDs of the four shared memory blocks to detach
 * @throws Error if Letta is not enabled or detachment fails for any agent
 */
export async function detachProjectFromTeam(
  memberLettaIds: string[],
  blockIds: SharedBlockIds
): Promise<void> {
  ensureLettaAvailable();

  try {
    await Promise.all(
      memberLettaIds.map((lettaAgentId) =>
        detachSharedBlocks(lettaAgentId, blockIds)
      )
    );
  } catch (error) {
    throw new Error(
      `Failed to detach project memory from team: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Load skills from a directory into all team agents' archival memory.
 *
 * Scans the given directory for SKILL.md files and inserts them into
 * each agent's archival memory as chunked passages.
 *
 * @param memberLettaIds - Array of Letta agent IDs for each team member
 * @param skillsDir - Absolute path to the skills directory
 * @returns Aggregated results of skill loading across all agents
 * @throws Error if Letta is not enabled or the skills directory is missing
 */
export async function loadTeamSkills(
  memberLettaIds: string[],
  skillsDir: string
): Promise<BulkSkillLoadResult[]> {
  ensureLettaAvailable();

  try {
    const results = await Promise.all(
      memberLettaIds.map((lettaAgentId) =>
        loadSkillsDirectory(lettaAgentId, skillsDir)
      )
    );
    return results;
  } catch (error) {
    throw new Error(
      `Failed to load team skills from "${skillsDir}": ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
