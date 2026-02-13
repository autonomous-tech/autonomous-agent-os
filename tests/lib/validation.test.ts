// =============================================================================
// Agent OS -- Library Tests: Validation
// =============================================================================
// Tests for the agent configuration validation function.
// Source: src/lib/validate.ts
//
// NOTE: The validateAgent function takes both a config and stages parameter.
// The config uses the AgentConfig type where `capabilities` is a nested object
// with a `tools` array. Templates use flat arrays which the getTools/getTriggers
// helpers handle transparently.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { validateAgent } from '@/lib/validate'
import { defaultStageData } from '@/lib/types'
import type { AgentConfig, StageData } from '@/lib/types'

// Helper to create a full valid config matching the AgentConfig type
function fullValidConfig(): AgentConfig {
  return {
    mission: {
      description: 'Customer support agent for SaaS product',
      tasks: [
        'Answer login questions',
        'Handle billing inquiries',
        'Log bug reports',
      ],
      exclusions: [
        'Never process refunds without approval',
        'Never access payment info directly',
      ],
      audience: { primary: 'End users', scope: 'public' },
    },
    identity: {
      name: 'Fixie',
      emoji: 'wrench',
      vibe: 'Friendly and helpful',
      tone: 'casual-professional',
      greeting: "Hey! I'm Fixie. What can I help you with?",
    },
    capabilities: {
      tools: [
        {
          id: 'kb_search',
          name: 'Knowledge Base Search',
          access: 'read-only',
          description: 'Search the knowledge base',
        },
      ],
    },
    memory: {
      strategy: 'conversational',
      remember: ['User preferences', 'Previous conversations'],
    },
    triggers: {
      triggers: [
        {
          type: 'message',
          description: 'Responds when a user starts a support chat',
          channels: ['web_chat', 'slack'],
        },
      ],
    },
    guardrails: {
      behavioral: [
        'Stay on-topic',
        'Never share user data',
        'Escalate after 2 failed attempts',
      ],
      prompt_injection_defense: 'strict',
      resource_limits: {
        max_turns_per_session: 50,
        escalation_threshold: 3,
      },
    },
  }
}

function fullValidStages(): StageData {
  const stages = defaultStageData();
  for (const key of Object.keys(stages) as Array<keyof StageData>) {
    stages[key].status = 'approved';
  }
  return stages;
}

// ===========================================================================
// Structural Validation (blocks export)
// ===========================================================================

describe('Structural Validation', () => {
  it('fails when agent name is missing', () => {
    const config = fullValidConfig()
    config.identity!.name = ''
    const result = validateAgent(config, fullValidStages())
    expect(result.valid).toBe(false)
    expect(result.errors.some((e: { level: string }) => e.level === 'structural')).toBe(true)
    expect(
      result.errors.some((e: { message: string }) => e.message.toLowerCase().includes('name'))
    ).toBe(true)
  })

  it('fails when mission description is missing', () => {
    const config = fullValidConfig()
    config.mission!.description = ''
    const result = validateAgent(config, fullValidStages())
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e: { level: string; message: string }) =>
          e.level === 'structural' &&
          e.message.toLowerCase().includes('description')
      )
    ).toBe(true)
  })

  it('fails when no tasks are defined', () => {
    const config = fullValidConfig()
    config.mission!.tasks = []
    const result = validateAgent(config, fullValidStages())
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e: { level: string; message: string }) =>
          e.level === 'structural' &&
          e.message.toLowerCase().includes('task')
      )
    ).toBe(true)
  })

  it('fails when identity section is entirely missing', () => {
    const config = fullValidConfig()
    ;(config as Record<string, unknown>).identity = undefined
    const result = validateAgent(config, fullValidStages())
    expect(result.valid).toBe(false)
    expect(result.errors.some((e: { level: string }) => e.level === 'structural')).toBe(true)
  })

  it('structural errors include a fix suggestion', () => {
    const config = fullValidConfig()
    config.identity!.name = ''
    const result = validateAgent(config, fullValidStages())
    const structuralErrors = result.errors.filter(
      (e: { level: string }) => e.level === 'structural'
    )

    expect(structuralErrors.length).toBeGreaterThan(0)
    for (const error of structuralErrors) {
      expect(error).toHaveProperty('fix')
      expect(typeof error.fix).toBe('string')
      expect(error.fix!.length).toBeGreaterThan(0)
    }
  })
})

// ===========================================================================
// Completeness Validation (warnings, do not block export)
// ===========================================================================

describe('Completeness Validation', () => {
  it('warns when no exclusions are defined', () => {
    const config = fullValidConfig()
    config.mission!.exclusions = []
    const result = validateAgent(config, fullValidStages())
    const completenessWarnings = result.warnings.filter(
      (w: { level: string }) => w.level === 'completeness'
    )
    expect(
      completenessWarnings.some((w: { message: string }) =>
        w.message.toLowerCase().includes('exclusion')
      )
    ).toBe(true)
  })

  it('warns when no triggers are defined', () => {
    const config = fullValidConfig()
    config.triggers = { triggers: [] }
    const result = validateAgent(config, fullValidStages())
    const completenessWarnings = result.warnings.filter(
      (w: { level: string }) => w.level === 'completeness'
    )
    expect(
      completenessWarnings.some((w: { message: string }) =>
        w.message.toLowerCase().includes('trigger')
      )
    ).toBe(true)
  })

  it('warns when identity tone is missing', () => {
    const config = fullValidConfig()
    config.identity!.tone = ''
    const result = validateAgent(config, fullValidStages())
    const warnings = result.warnings.filter(
      (w: { level: string }) => w.level === 'completeness'
    )
    expect(
      warnings.some((w: { message: string }) => w.message.toLowerCase().includes('tone'))
    ).toBe(true)
  })

  it('warns when no memory strategy is configured', () => {
    const config = fullValidConfig()
    config.memory!.strategy = undefined
    const result = validateAgent(config, fullValidStages())
    const warnings = result.warnings.filter(
      (w: { level: string }) => w.level === 'completeness'
    )
    expect(
      warnings.some((w: { message: string }) => w.message.toLowerCase().includes('memory'))
    ).toBe(true)
  })

  it('warns when no guardrails are defined', () => {
    const config = fullValidConfig()
    config.guardrails!.behavioral = []
    const result = validateAgent(config, fullValidStages())
    const warnings = result.warnings.filter(
      (w: { level: string }) => w.level === 'completeness'
    )
    expect(
      warnings.some((w: { message: string }) => w.message.toLowerCase().includes('guardrail'))
    ).toBe(true)
  })
})

// ===========================================================================
// Consistency Validation
// ===========================================================================

describe('Consistency Validation', () => {
  it('warns when incomplete stages exist', () => {
    const config = fullValidConfig()
    const stages = fullValidStages()
    stages.memory.status = 'incomplete'
    stages.triggers.status = 'incomplete'
    const result = validateAgent(config, stages)
    const consistencyWarnings = result.warnings.filter(
      (w: { level: string }) => w.level === 'consistency'
    )
    expect(
      consistencyWarnings.some(
        (w: { message: string }) =>
          w.message.toLowerCase().includes('stage')
      )
    ).toBe(true)
  })
})

// ===========================================================================
// Full Valid Config
// ===========================================================================

describe('Full Valid Config', () => {
  it('passes all checks with a complete Fixie config', () => {
    const result = validateAgent(fullValidConfig(), fullValidStages())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('may have warnings but no errors for a complete config', () => {
    const result = validateAgent(fullValidConfig(), fullValidStages())
    expect(result.errors).toHaveLength(0)
  })
})

// ===========================================================================
// Incomplete Config
// ===========================================================================

describe('Incomplete Config', () => {
  it('fails validation with multiple errors for a blank config', () => {
    const result = validateAgent({}, defaultStageData())
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('returns errors with proper structure (level, message, fix)', () => {
    const result = validateAgent({}, defaultStageData())
    for (const error of result.errors) {
      expect(error).toHaveProperty('level')
      expect(error).toHaveProperty('message')
      expect(error).toHaveProperty('fix')
      expect(typeof error.message).toBe('string')
      expect(error.message.length).toBeGreaterThan(0)
    }
  })
})
