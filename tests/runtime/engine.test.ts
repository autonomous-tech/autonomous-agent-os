import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processMessage } from '@/lib/runtime/engine'
import { chat } from '@/lib/claude'
import { sampleAgentConfig } from '../helpers/fixtures'
import { buildRuntimeSystemPrompt } from '@/lib/runtime/prompt'
import type { RuntimeMessage } from '@/lib/runtime/types'

const mockedChat = vi.mocked(chat)

describe('processMessage', () => {
  const systemPrompt = buildRuntimeSystemPrompt(sampleAgentConfig)

  beforeEach(() => {
    mockedChat.mockReset()
    mockedChat.mockResolvedValue('Hello! How can I help you today?')
  })

  it('processes a message and returns a response', async () => {
    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      0,
      0,
      [],
      'Hi there!'
    )

    expect(result.response.role).toBe('assistant')
    expect(result.response.content).toBe('Hello! How can I help you today?')
    expect(result.sessionUpdates.turnCount).toBe(1)
    expect(result.sessionUpdates.status).toBe('active')
  })

  it('blocks messages when session is ended', async () => {
    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'ended',
      10,
      0,
      [],
      'Another message'
    )

    expect(result.response.content).toBe('Session has ended')
    expect(result.response.metadata?.blocked).toBe(true)
    expect(result.guardrailNotice).toBe('Session has ended')
    expect(mockedChat).not.toHaveBeenCalled()
  })

  it('ends session when max turns reached', async () => {
    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      50,
      0,
      [],
      'One more message'
    )

    expect(result.sessionUpdates.status).toBe('ended')
    expect(result.guardrailNotice).toContain('Maximum turns reached')
    expect(mockedChat).not.toHaveBeenCalled()
  })

  it('increments turn count', async () => {
    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      5,
      0,
      [],
      'Hello'
    )

    expect(result.sessionUpdates.turnCount).toBe(6)
  })

  it('passes history to Claude', async () => {
    const history: RuntimeMessage[] = [
      { id: '1', role: 'user', content: 'First message', timestamp: new Date().toISOString() },
      { id: '2', role: 'assistant', content: 'First reply', timestamp: new Date().toISOString() },
    ]

    await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      1,
      0,
      history,
      'Second message'
    )

    expect(mockedChat).toHaveBeenCalledWith(
      systemPrompt,
      [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First reply' },
        { role: 'user', content: 'Second message' },
      ],
      undefined
    )
  })

  it('caps history at 40 messages', async () => {
    const history: RuntimeMessage[] = Array.from({ length: 50 }, (_, i) => ({
      id: `msg_${i}`,
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}`,
      timestamp: new Date().toISOString(),
    }))

    await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      25,
      0,
      history,
      'New message'
    )

    // 40 capped + 1 new = 41 messages
    const callArgs = mockedChat.mock.calls[0]
    expect(callArgs[1].length).toBe(41)
  })

  it('passes maxTokens from guardrails config', async () => {
    const configWithLength = {
      ...sampleAgentConfig,
      guardrails: {
        ...sampleAgentConfig.guardrails,
        resource_limits: {
          ...sampleAgentConfig.guardrails?.resource_limits,
          max_response_length: 500,
        },
      },
    }

    await processMessage(
      systemPrompt,
      configWithLength,
      'active',
      0,
      0,
      [],
      'Hello'
    )

    expect(mockedChat).toHaveBeenCalledWith(
      systemPrompt,
      [{ role: 'user', content: 'Hello' }],
      { maxTokens: 500 }
    )
  })

  it('sets session to ended on last turn', async () => {
    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      49,
      0,
      [],
      'Last turn message'
    )

    expect(result.sessionUpdates.turnCount).toBe(50)
    expect(result.sessionUpdates.status).toBe('ended')
    expect(result.guardrailNotice).toContain('maximum 50 turns')
  })
})
