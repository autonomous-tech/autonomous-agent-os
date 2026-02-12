import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processMessage } from '@/lib/runtime/engine'
import { chat } from '@/lib/claude'
import { sampleAgentConfig } from '../helpers/fixtures'
import { buildRuntimeSystemPrompt } from '@/lib/runtime/prompt'
import type { AgentConfig } from '@/lib/types'
import type { RuntimeMessage } from '@/lib/runtime/types'

const mockedChat = vi.mocked(chat)

describe('Engine Integration', () => {
  const systemPrompt = buildRuntimeSystemPrompt(sampleAgentConfig)

  beforeEach(() => {
    mockedChat.mockReset()
    mockedChat.mockResolvedValue('Test response')
  })

  it('multi-turn conversation passes growing history to Claude', async () => {
    // Turn 1
    const result1 = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      0,
      0,
      [],
      'First message'
    )

    expect(mockedChat).toHaveBeenCalledWith(
      systemPrompt,
      [{ role: 'user', content: 'First message' }],
      undefined
    )

    // Build history after turn 1
    const history: RuntimeMessage[] = [
      { id: 'msg_1', role: 'user', content: 'First message', timestamp: new Date().toISOString() },
      result1.response,
    ]

    // Turn 2
    await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      1,
      0,
      history,
      'Second message'
    )

    const turn2Call = mockedChat.mock.calls[1]
    // Should have: 2 history + 1 new = 3 messages
    expect(turn2Call[1]).toHaveLength(3)
    expect(turn2Call[1][0].content).toBe('First message')
    expect(turn2Call[1][1].content).toBe('Test response')
    expect(turn2Call[1][2].content).toBe('Second message')
  })

  it('session lifecycle: active → turn limit → ended', async () => {
    const config: AgentConfig = {
      ...sampleAgentConfig,
      guardrails: {
        ...sampleAgentConfig.guardrails,
        resource_limits: { max_turns_per_session: 3 },
      },
    }

    // Turn 1 — active
    const r1 = await processMessage(systemPrompt, config, 'active', 0, 0, [], 'Turn 1')
    expect(r1.sessionUpdates.status).toBe('active')
    expect(r1.sessionUpdates.turnCount).toBe(1)

    // Turn 2 — active
    const r2 = await processMessage(systemPrompt, config, 'active', 1, 0, [], 'Turn 2')
    expect(r2.sessionUpdates.status).toBe('active')
    expect(r2.sessionUpdates.turnCount).toBe(2)

    // Turn 3 — ended (reaches max)
    const r3 = await processMessage(systemPrompt, config, 'active', 2, 0, [], 'Turn 3')
    expect(r3.sessionUpdates.status).toBe('ended')
    expect(r3.sessionUpdates.turnCount).toBe(3)
    expect(r3.guardrailNotice).toContain('maximum 3 turns')
  })

  it('escalated session blocks messages without calling Claude', async () => {
    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'escalated',
      5,
      3,
      [],
      'Another message'
    )

    expect(result.response.metadata?.blocked).toBe(true)
    expect(result.response.content).toContain('escalated')
    expect(result.guardrailNotice).toContain('escalated')
    expect(mockedChat).not.toHaveBeenCalled()
  })

  it('truncates history at 40 messages, keeps 41 total with new message', async () => {
    const history: RuntimeMessage[] = Array.from({ length: 60 }, (_, i) => ({
      id: `msg_${i}`,
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}`,
      timestamp: new Date().toISOString(),
    }))

    await processMessage(systemPrompt, sampleAgentConfig, 'active', 30, 0, history, 'New message')

    const callArgs = mockedChat.mock.calls[0]
    // 40 capped + 1 new = 41
    expect(callArgs[1]).toHaveLength(41)
    // Should have the last 40 from history + the new message
    expect(callArgs[1][0].content).toBe('Message 20') // history[60-40] = history[20]
    expect(callArgs[1][40].content).toBe('New message')
  })

  it('keeps all messages when under 40', async () => {
    const history: RuntimeMessage[] = Array.from({ length: 10 }, (_, i) => ({
      id: `msg_${i}`,
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}`,
      timestamp: new Date().toISOString(),
    }))

    await processMessage(systemPrompt, sampleAgentConfig, 'active', 5, 0, history, 'New message')

    const callArgs = mockedChat.mock.calls[0]
    // 10 history + 1 new = 11
    expect(callArgs[1]).toHaveLength(11)
  })

  it('custom turn limit (5) — ends at turn 5', async () => {
    const config: AgentConfig = {
      ...sampleAgentConfig,
      guardrails: {
        ...sampleAgentConfig.guardrails,
        resource_limits: { max_turns_per_session: 5 },
      },
    }

    const result = await processMessage(systemPrompt, config, 'active', 4, 0, [], 'Turn 5')

    expect(result.sessionUpdates.turnCount).toBe(5)
    expect(result.sessionUpdates.status).toBe('ended')
    expect(result.guardrailNotice).toContain('5 turns')
  })

  it('defaults to 50 turns when no guardrails set', async () => {
    const config: AgentConfig = {
      ...sampleAgentConfig,
      guardrails: undefined,
    }

    const result = await processMessage(systemPrompt, config, 'active', 48, 0, [], 'Turn 49')

    expect(result.sessionUpdates.status).toBe('active')
    expect(result.sessionUpdates.turnCount).toBe(49)
  })

  it('passes maxTokens when max_response_length set', async () => {
    const config: AgentConfig = {
      ...sampleAgentConfig,
      guardrails: {
        ...sampleAgentConfig.guardrails,
        resource_limits: {
          ...sampleAgentConfig.guardrails?.resource_limits,
          max_response_length: 500,
        },
      },
    }

    await processMessage(systemPrompt, config, 'active', 0, 0, [], 'Hello')

    expect(mockedChat).toHaveBeenCalledWith(
      systemPrompt,
      [{ role: 'user', content: 'Hello' }],
      { maxTokens: 500 }
    )
  })

  it('caps maxTokens at 4096', async () => {
    const config: AgentConfig = {
      ...sampleAgentConfig,
      guardrails: {
        ...sampleAgentConfig.guardrails,
        resource_limits: {
          ...sampleAgentConfig.guardrails?.resource_limits,
          max_response_length: 8000,
        },
      },
    }

    await processMessage(systemPrompt, config, 'active', 0, 0, [], 'Hello')

    expect(mockedChat).toHaveBeenCalledWith(
      systemPrompt,
      [{ role: 'user', content: 'Hello' }],
      { maxTokens: 4096 }
    )
  })

  it('response structure has correct format', async () => {
    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      0,
      0,
      [],
      'Hello'
    )

    expect(result.response.id).toMatch(/^msg_/)
    expect(result.response.role).toBe('assistant')
    expect(result.response.content).toBe('Test response')
    // Validate ISO timestamp
    expect(() => new Date(result.response.timestamp)).not.toThrow()
    expect(new Date(result.response.timestamp).toISOString()).toBe(result.response.timestamp)
  })
})
