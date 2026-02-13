import type { AgentConfig, StageData, ValidationResult, ValidationError } from "@/lib/types";
import { getTools, getTriggers } from "@/lib/types";

/**
 * Validate an agent configuration before deployment.
 */
export function validateAgent(config: AgentConfig, stages: StageData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Structural checks (block deployment)
  if (!config.identity?.name) {
    errors.push({
      level: "structural",
      message: "Agent name is missing",
      fix: "Set a name in the Identity stage",
    });
  }

  if (!config.mission?.description) {
    errors.push({
      level: "structural",
      message: "Mission description is missing",
      fix: "Add a description in the Mission stage",
    });
  }

  if (!config.mission?.tasks || config.mission.tasks.length === 0) {
    errors.push({
      level: "structural",
      message: "No tasks defined",
      fix: "Add at least one task in the Mission stage",
    });
  }

  // Completeness checks (warn only)
  if (!config.mission?.exclusions || config.mission.exclusions.length === 0) {
    warnings.push({
      level: "completeness",
      message: "No exclusions defined -- consider adding boundaries",
    });
  }

  if (getTools(config).length === 0) {
    warnings.push({
      level: "completeness",
      message: "No capabilities defined -- your agent has no tools",
    });
  }

  if (!config.guardrails?.behavioral || config.guardrails.behavioral.length === 0) {
    warnings.push({
      level: "completeness",
      message: "No guardrails defined -- consider adding safety rules",
    });
  }

  if (!config.identity?.tone) {
    warnings.push({
      level: "completeness",
      message: "No tone set for the agent identity",
    });
  }

  if (!config.memory?.strategy) {
    warnings.push({
      level: "completeness",
      message: "No memory strategy configured -- defaults will be used",
    });
  }

  if (getTriggers(config).length === 0) {
    warnings.push({
      level: "completeness",
      message: "No triggers configured -- agent has no activation rules",
    });
  }

  // Consistency checks (warn only)
  const incompleteStages = Object.entries(stages).filter(
    ([, entry]) => entry.status === "incomplete"
  );
  if (incompleteStages.length > 0) {
    warnings.push({
      level: "consistency",
      message: `${incompleteStages.length} stage(s) not yet configured: ${incompleteStages.map(([name]) => name).join(", ")}`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
