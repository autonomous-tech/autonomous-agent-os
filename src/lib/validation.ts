// =============================================================================
// Agent OS -- Validation Logic
// =============================================================================
// Three-level validation for agent configurations:
//   1. Structural  -- blocks export if failing
//   2. Completeness -- warning only
//   3. Consistency  -- warning only
// =============================================================================

/**
 * Agent configuration shape used for validation.
 * Defined locally to avoid circular dependency with the main types module.
 */
interface AgentConfig {
  mission?: {
    description: string;
    tasks: string[];
    exclusions: string[];
    audience: { primary: string; scope: string };
  };
  identity?: {
    name: string;
    emoji?: string;
    vibe: string;
    tone: string;
    greeting?: string;
  };
  capabilities?: Array<{
    id: string;
    name: string;
    access: string;
    description: string;
  }>;
  memory?: {
    strategy: string;
    remember: string[];
    daily_logs: boolean;
    curated_memory: boolean;
    max_memory_size: string;
  };
  triggers?: Array<{
    type: string;
    description: string;
    channels?: string[];
    source?: string;
  }>;
  guardrails?: {
    behavioral: string[];
    prompt_injection_defense: string;
    resource_limits?: {
      max_turns_per_session: number;
      escalation_threshold: number;
    };
  };
}

interface ValidationError {
  level: string;
  message: string;
  fix: string;
}

interface ValidationWarning {
  level: string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validates an agent configuration across three levels:
 *
 * **Structural** (errors -- block export):
 * - Agent name must exist
 * - Description must exist
 * - At least 1 capability must be defined
 *
 * **Completeness** (warnings -- shown but don't block):
 * - Mission should have description, tasks, and exclusions
 * - Identity should have name and tone
 * - At least 1 memory category should be active
 * - At least 1 trigger should be configured
 * - At least 1 guardrail should be active
 *
 * **Consistency** (warnings -- shown but don't block):
 * - Capabilities should exist when mission tasks are defined
 *
 * @param config - The agent configuration to validate
 * @returns Validation result with errors (blocking) and warnings (non-blocking)
 */
export function validateAgent(config: AgentConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // ---------------------------------------------------------------------------
  // Level 1: Structural -- these block export
  // ---------------------------------------------------------------------------

  if (!config.identity?.name || config.identity.name.trim() === "") {
    errors.push({
      level: "structural",
      message: "Agent name is missing",
      fix: "Set a name in the Identity stage",
    });
  }

  if (!config.mission?.description || config.mission.description.trim() === "") {
    errors.push({
      level: "structural",
      message: "Agent description is missing",
      fix: "Add a one-line description in the Mission stage",
    });
  }

  if (!config.capabilities || config.capabilities.length === 0) {
    errors.push({
      level: "structural",
      message: "No capabilities defined",
      fix: "Add at least one capability in the Capabilities stage",
    });
  }

  // ---------------------------------------------------------------------------
  // Level 2: Completeness -- warnings only
  // ---------------------------------------------------------------------------

  // Mission completeness
  if (config.mission) {
    if (!config.mission.tasks || config.mission.tasks.length === 0) {
      warnings.push({
        level: "completeness",
        message: "No key tasks defined in mission -- consider adding what the agent should do",
      });
    }

    if (!config.mission.exclusions || config.mission.exclusions.length === 0) {
      warnings.push({
        level: "completeness",
        message: "No exclusions defined -- consider adding boundaries for what the agent should NOT do",
      });
    }

    if (!config.mission.audience?.scope) {
      warnings.push({
        level: "completeness",
        message: "Audience scope not specified -- defaults may not match your intent",
      });
    }
  } else {
    warnings.push({
      level: "completeness",
      message: "Mission section is empty -- the agent has no defined purpose",
    });
  }

  // Identity completeness
  if (config.identity) {
    if (!config.identity.tone || config.identity.tone.trim() === "") {
      warnings.push({
        level: "completeness",
        message: "Communication tone not set -- the agent's personality may be inconsistent",
      });
    }
  } else {
    warnings.push({
      level: "completeness",
      message: "Identity section is empty -- the agent has no name or personality",
    });
  }

  // Memory completeness
  if (!config.memory || !config.memory.remember || config.memory.remember.length === 0) {
    warnings.push({
      level: "completeness",
      message: "No memory categories configured -- the agent will not remember anything between sessions",
    });
  }

  // Triggers completeness
  if (!config.triggers || config.triggers.length === 0) {
    warnings.push({
      level: "completeness",
      message: "No triggers configured -- the agent has no defined activation method",
    });
  }

  // Guardrails completeness
  if (!config.guardrails || !config.guardrails.behavioral || config.guardrails.behavioral.length === 0) {
    warnings.push({
      level: "completeness",
      message: "No behavioral guardrails defined -- the agent has no safety boundaries",
    });
  }

  if (!config.guardrails?.prompt_injection_defense) {
    warnings.push({
      level: "completeness",
      message: "Prompt injection defense level not set -- recommended to set to 'strict'",
    });
  }

  // ---------------------------------------------------------------------------
  // Level 3: Consistency -- warnings only
  // ---------------------------------------------------------------------------

  // Warn if mission has tasks but capabilities list is empty
  const hasTasks = config.mission?.tasks && config.mission.tasks.length > 0;
  const hasCapabilities = config.capabilities && config.capabilities.length > 0;

  if (hasTasks && !hasCapabilities) {
    warnings.push({
      level: "consistency",
      message: "Mission defines tasks but no capabilities are configured -- the agent may not have the tools to complete its tasks",
    });
  }

  // Warn if capabilities exist but no tasks reference them
  if (hasCapabilities && !hasTasks) {
    warnings.push({
      level: "consistency",
      message: "Capabilities are defined but mission has no tasks -- consider defining what the agent should accomplish",
    });
  }

  // ---------------------------------------------------------------------------
  // Result
  // ---------------------------------------------------------------------------

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
