// =============================================================================
// Agent OS -- Library Tests: Validation
// =============================================================================
// Tests for the agent configuration validation function.
// Source: src/lib/validation.ts
//
// NOTE: This module defines its own AgentConfig type where `capabilities` is
// a flat array of capabilities (not nested as { tools: [...] }). Similarly,
// `triggers` is a flat array. This is important for test data construction.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { validateAgent } from '@/lib/validation'

// Helper to create a full valid config matching the validation module's types
function fullValidConfig() {
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
    capabilities: [
      {
        id: 'kb_search',
        name: 'Knowledge Base Search',
        access: 'read-only',
        description: 'Search the knowledge base',
      },
    ],
    memory: {
      strategy: 'conversational',
      remember: ['User preferences', 'Previous conversations'],
      daily_logs: true,
      curated_memory: true,
      max_memory_size: '500 lines',
    },
    triggers: [
      {
        type: 'message',
        description: 'Responds when a user starts a support chat',
        channels: ['web_chat', 'slack'],
      },
    ],
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

// ===========================================================================
// Structural Validation (blocks export)
// ===========================================================================

describe('Structural Validation', () => {
  it('fails when agent name is missing', () => {
    const config = fullValidConfig()
    config.identity.name = ''
    const result = validateAgent(config)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.level === 'structural')).toBe(true)
    expect(
      result.errors.some((e) => e.message.toLowerCase().includes('name'))
    ).toBe(true)
  })

  it('fails when mission description is missing', () => {
    const config = fullValidConfig()
    config.mission.description = ''
    const result = validateAgent(config)
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e) =>
          e.level === 'structural' &&
          e.message.toLowerCase().includes('description')
      )
    ).toBe(true)
  })

  it('fails when no capabilities are defined', () => {
    const config = fullValidConfig()
    config.capabilities = []
    const result = validateAgent(config)
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e) =>
          e.level === 'structural' &&
          e.message.toLowerCase().includes('capabilities')
      )
    ).toBe(true)
  })

  it('fails when identity section is entirely missing', () => {
    const config = fullValidConfig()
    ;(config as Record<string, unknown>).identity = undefined
    const result = validateAgent(config)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.level === 'structural')).toBe(true)
  })

  it('structural errors include a fix suggestion', () => {
    const config = fullValidConfig()
    config.identity.name = ''
    const result = validateAgent(config)
    const structuralErrors = result.errors.filter(
      (e) => e.level === 'structural'
    )

    expect(structuralErrors.length).toBeGreaterThan(0)
    for (const error of structuralErrors) {
      expect(error).toHaveProperty('fix')
      expect(typeof error.fix).toBe('string')
      expect(error.fix.length).toBeGreaterThan(0)
    }
  })
})

// ===========================================================================
// Completeness Validation (warnings, do not block export)
// ===========================================================================

describe('Completeness Validation', () => {
  it('warns when no exclusions are defined', () => {
    const config = fullValidConfig()
    config.mission.exclusions = []
    const result = validateAgent(config)
    const completenessWarnings = result.warnings.filter(
      (w) => w.level === 'completeness'
    )
    expect(
      completenessWarnings.some((w) =>
        w.message.toLowerCase().includes('exclusion')
      )
    ).toBe(true)
  })

  it('warns when no triggers are defined', () => {
    const config = fullValidConfig()
    config.triggers = []
    const result = validateAgent(config)
    const completenessWarnings = result.warnings.filter(
      (w) => w.level === 'completeness'
    )
    expect(
      completenessWarnings.some((w) =>
        w.message.toLowerCase().includes('trigger')
      )
    ).toBe(true)
  })

  it('warns when no tasks are defined', () => {
    const config = fullValidConfig()
    config.mission.tasks = []
    const result = validateAgent(config)
    const completenessWarnings = result.warnings.filter(
      (w) => w.level === 'completeness'
    )
    expect(
      completenessWarnings.some((w) =>
        w.message.toLowerCase().includes('task')
      )
    ).toBe(true)
  })

  it('warns when identity tone is missing', () => {
    const config = fullValidConfig()
    config.identity.tone = ''
    const result = validateAgent(config)
    const warnings = result.warnings.filter(
      (w) => w.level === 'completeness'
    )
    expect(
      warnings.some((w) => w.message.toLowerCase().includes('tone'))
    ).toBe(true)
  })

  it('warns when no memory categories are configured', () => {
    const config = fullValidConfig()
    config.memory.remember = []
    const result = validateAgent(config)
    const warnings = result.warnings.filter(
      (w) => w.level === 'completeness'
    )
    expect(
      warnings.some((w) => w.message.toLowerCase().includes('memory'))
    ).toBe(true)
  })

  it('warns when no guardrails are defined', () => {
    const config = fullValidConfig()
    config.guardrails.behavioral = []
    const result = validateAgent(config)
    const warnings = result.warnings.filter(
      (w) => w.level === 'completeness'
    )
    expect(
      warnings.some((w) => w.message.toLowerCase().includes('guardrail'))
    ).toBe(true)
  })

  it('warns when prompt injection defense level is not set', () => {
    const config = fullValidConfig()
    ;(config.guardrails as Record<string, unknown>).prompt_injection_defense = undefined
    const result = validateAgent(config)
    const warnings = result.warnings.filter(
      (w) => w.level === 'completeness'
    )
    expect(
      warnings.some((w) =>
        w.message.toLowerCase().includes('prompt injection')
      )
    ).toBe(true)
  })

  it('warns when mission section is entirely missing', () => {
    const config = fullValidConfig()
    ;(config as Record<string, unknown>).mission = undefined
    const result = validateAgent(config)
    const warnings = result.warnings.filter(
      (w) => w.level === 'completeness'
    )
    expect(
      warnings.some((w) => w.message.toLowerCase().includes('mission'))
    ).toBe(true)
  })
})

// ===========================================================================
// Consistency Validation
// ===========================================================================

describe('Consistency Validation', () => {
  it('warns when tasks exist but no capabilities are defined', () => {
    const config = fullValidConfig()
    config.capabilities = []
    const result = validateAgent(config)
    // This would also trigger a structural error, so we look for consistency warnings
    const consistencyWarnings = result.warnings.filter(
      (w) => w.level === 'consistency'
    )
    expect(
      consistencyWarnings.some(
        (w) =>
          w.message.toLowerCase().includes('task') &&
          w.message.toLowerCase().includes('capabilit')
      )
    ).toBe(true)
  })

  it('warns when capabilities exist but no tasks are defined', () => {
    const config = fullValidConfig()
    config.mission.tasks = []
    const result = validateAgent(config)
    const consistencyWarnings = result.warnings.filter(
      (w) => w.level === 'consistency'
    )
    expect(
      consistencyWarnings.some(
        (w) =>
          w.message.toLowerCase().includes('capabilit') &&
          w.message.toLowerCase().includes('task')
      )
    ).toBe(true)
  })
})

// ===========================================================================
// Full Valid Config
// ===========================================================================

describe('Full Valid Config', () => {
  it('passes all checks with a complete Fixie config', () => {
    const result = validateAgent(fullValidConfig())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('may have warnings but no errors for a complete config', () => {
    const result = validateAgent(fullValidConfig())
    expect(result.errors).toHaveLength(0)
  })
})

// ===========================================================================
// Incomplete Config
// ===========================================================================

describe('Incomplete Config', () => {
  it('fails validation with multiple errors for a blank config', () => {
    const result = validateAgent({})
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('returns errors with proper structure (level, message, fix)', () => {
    const result = validateAgent({})
    for (const error of result.errors) {
      expect(error).toHaveProperty('level')
      expect(error).toHaveProperty('message')
      expect(error).toHaveProperty('fix')
      expect(typeof error.message).toBe('string')
      expect(error.message.length).toBeGreaterThan(0)
    }
  })
})
