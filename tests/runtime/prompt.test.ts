import { describe, it, expect } from 'vitest'
import { buildRuntimeSystemPrompt } from '@/lib/runtime/prompt'
import { sampleAgentConfig } from '../helpers/fixtures'
import type { AgentConfig } from '@/lib/types'

describe('buildRuntimeSystemPrompt', () => {
  it('builds a complete prompt from a full config', () => {
    const prompt = buildRuntimeSystemPrompt(sampleAgentConfig)

    expect(prompt).toContain('You are Fixie.')
    expect(prompt).toContain('IDENTITY:')
    expect(prompt).toContain('Tone: casual-professional')
    expect(prompt).toContain('MISSION:')
    expect(prompt).toContain('Customer support agent')
    expect(prompt).toContain('Key Tasks:')
    expect(prompt).toContain('Answer login and authentication questions')
    expect(prompt).toContain('Exclusions (NEVER do these):')
    expect(prompt).toContain('Never process refunds')
    expect(prompt).toContain('CAPABILITIES:')
    expect(prompt).toContain('Knowledge Base Search')
    expect(prompt).toContain('GUARDRAILS:')
    expect(prompt).toContain('Stay on-topic')
    expect(prompt).toContain('SECURITY:')
    expect(prompt).toContain('RULES:')
    expect(prompt).toContain('Stay in character as Fixie')
  })

  it('uses defaults for empty config', () => {
    const prompt = buildRuntimeSystemPrompt({})

    expect(prompt).toContain('You are Agent.')
    expect(prompt).toContain('Tone: friendly')
    expect(prompt).toContain('Vibe: Helpful and professional')
    expect(prompt).toContain('General purpose assistant')
    expect(prompt).toContain('Follow general safety guidelines')
    expect(prompt).not.toContain('CAPABILITIES:')
    expect(prompt).not.toContain('SECURITY:')
  })

  it('omits security section when defense is not strict', () => {
    const config: AgentConfig = {
      guardrails: {
        prompt_injection_defense: 'moderate',
        behavioral: ['Be nice'],
      },
    }
    const prompt = buildRuntimeSystemPrompt(config)
    expect(prompt).not.toContain('SECURITY:')
    expect(prompt).toContain('Be nice')
  })

  it('does not mention Claude or testing', () => {
    const prompt = buildRuntimeSystemPrompt(sampleAgentConfig)
    expect(prompt).not.toContain('testing purposes')
    expect(prompt).not.toContain('<metadata>')
    expect(prompt).toContain('Do NOT mention that you are Claude')
  })
})
