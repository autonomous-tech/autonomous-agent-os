// =============================================================================
// Agent OS -- Library Tests: Validation
// =============================================================================
// Tests for the validateAgent function extracted to src/lib/validate.ts.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { validateAgent } from '@/lib/validate'
import type { AgentConfig, StageData } from '@/lib/types'
import { sampleAgentConfig, sampleStageData } from '../helpers/fixtures'

// ===========================================================================
// validateAgent
// ===========================================================================

describe('validateAgent', () => {
  it('returns valid=true for a complete config with all stages', () => {
    const result = validateAgent(sampleAgentConfig, sampleStageData)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns structural error when identity name is missing', () => {
    const config: AgentConfig = {
      ...sampleAgentConfig,
      identity: { ...sampleAgentConfig.identity, name: undefined },
    }
    const result = validateAgent(config, sampleStageData)
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e) => e.level === 'structural' && e.message.includes('name')
      )
    ).toBe(true)
  })

  it('returns structural error when mission description is missing', () => {
    const config: AgentConfig = {
      ...sampleAgentConfig,
      mission: { ...sampleAgentConfig.mission, description: undefined },
    }
    const result = validateAgent(config, sampleStageData)
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e) => e.level === 'structural' && e.message.includes('description')
      )
    ).toBe(true)
  })

  it('returns structural error when no tasks are defined', () => {
    const config: AgentConfig = {
      ...sampleAgentConfig,
      mission: { ...sampleAgentConfig.mission, tasks: [] },
    }
    const result = validateAgent(config, sampleStageData)
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e) => e.level === 'structural' && e.message.includes('tasks')
      )
    ).toBe(true)
  })

  it('returns completeness warning when no exclusions are defined', () => {
    const config: AgentConfig = {
      ...sampleAgentConfig,
      mission: { ...sampleAgentConfig.mission, exclusions: [] },
    }
    const result = validateAgent(config, sampleStageData)
    expect(result.valid).toBe(true) // Should not block
    expect(
      result.warnings.some(
        (w) => w.level === 'completeness' && w.message.includes('exclusion')
      )
    ).toBe(true)
  })

  it('returns consistency warning for incomplete stages', () => {
    const incompleteStages: StageData = {
      mission: { status: 'approved', data: {} },
      identity: { status: 'approved', data: {} },
      capabilities: { status: 'incomplete', data: {} },
      memory: { status: 'incomplete', data: {} },
      triggers: { status: 'incomplete', data: {} },
      guardrails: { status: 'incomplete', data: {} },
    }
    const result = validateAgent(sampleAgentConfig, incompleteStages)
    expect(
      result.warnings.some(
        (w) =>
          w.level === 'consistency' &&
          w.message.includes('not yet configured')
      )
    ).toBe(true)
  })
})
