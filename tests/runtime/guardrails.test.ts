import { describe, it, expect } from 'vitest'
import { checkPreMessage, checkPostMessage } from '@/lib/runtime/guardrails'
import type { GuardrailsConfig } from '@/lib/types'

describe('checkPreMessage', () => {
  const defaultGuardrails: GuardrailsConfig = {
    behavioral: ['Stay on topic'],
    prompt_injection_defense: 'strict',
    resource_limits: {
      max_turns_per_session: 50,
      escalation_threshold: 3,
    },
  }

  it('allows messages when session is active and under turn limit', () => {
    const result = checkPreMessage(defaultGuardrails, 5, 'active')
    expect(result.allowed).toBe(true)
  })

  it('blocks messages when session is ended', () => {
    const result = checkPreMessage(defaultGuardrails, 5, 'ended')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Session has ended')
    expect(result.action).toBe('block')
  })

  it('blocks messages when session is escalated', () => {
    const result = checkPreMessage(defaultGuardrails, 5, 'escalated')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Session has been escalated to a human')
    expect(result.action).toBe('block')
  })

  it('blocks and ends session when turn limit is reached', () => {
    const result = checkPreMessage(defaultGuardrails, 50, 'active')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Maximum turns reached (50)')
    expect(result.action).toBe('end_session')
  })

  it('blocks when turn count exceeds limit', () => {
    const result = checkPreMessage(defaultGuardrails, 100, 'active')
    expect(result.allowed).toBe(false)
    expect(result.action).toBe('end_session')
  })

  it('uses default of 50 turns when guardrails are undefined', () => {
    const result = checkPreMessage(undefined, 49, 'active')
    expect(result.allowed).toBe(true)

    const result2 = checkPreMessage(undefined, 50, 'active')
    expect(result2.allowed).toBe(false)
  })

  it('respects custom turn limits', () => {
    const customGuardrails: GuardrailsConfig = {
      resource_limits: { max_turns_per_session: 10 },
    }
    const result = checkPreMessage(customGuardrails, 10, 'active')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Maximum turns reached (10)')
  })
})

describe('checkPostMessage', () => {
  const defaultGuardrails: GuardrailsConfig = {
    resource_limits: { escalation_threshold: 3 },
  }

  it('does not escalate when under threshold', () => {
    const result = checkPostMessage(defaultGuardrails, 1)
    expect(result.shouldEscalate).toBe(false)
    expect(result.failedAttempts).toBe(1)
  })

  it('escalates when at threshold', () => {
    const result = checkPostMessage(defaultGuardrails, 3)
    expect(result.shouldEscalate).toBe(true)
  })

  it('escalates when over threshold', () => {
    const result = checkPostMessage(defaultGuardrails, 5)
    expect(result.shouldEscalate).toBe(true)
  })

  it('uses default threshold of 3 when undefined', () => {
    const result = checkPostMessage(undefined, 2)
    expect(result.shouldEscalate).toBe(false)

    const result2 = checkPostMessage(undefined, 3)
    expect(result2.shouldEscalate).toBe(true)
  })
})
