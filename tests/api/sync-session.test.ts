import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import { POST } from '@/app/api/agents/[id]/sync-session/route'
import { createTestAgent, cleanupDb, createRequest, parseResponse } from '../helpers/db'

// Mock Letta client per-file (not global)
vi.mock('@/lib/letta/client', () => ({
  isLettaEnabled: vi.fn().mockReturnValue(true),
  lettaClient: {
    agents: {
      blocks: {
        retrieve: vi.fn().mockResolvedValue({
          id: 'block-1',
          label: 'persona',
          value: 'Existing persona content.',
          limit: 5000,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'block-1',
          label: 'persona',
          value: 'Updated content.',
          limit: 5000,
        }),
      },
      passages: {
        create: vi.fn().mockResolvedValue({ id: 'passage-1' }),
      },
    },
  },
}))

// Mock chat to return categorized learnings
vi.mock('@/lib/claude', async () => {
  const actual = await vi.importActual('@/lib/claude')
  return {
    ...actual as Record<string, unknown>,
    chat: vi.fn().mockResolvedValue(
      JSON.stringify({
        persona: ['User prefers dark mode'],
        decisions: ['Chose React over Vue'],
        archival: ['Learned about event sourcing patterns'],
      })
    ),
  }
})

import { isLettaEnabled } from '@/lib/letta/client'

describe('POST /api/agents/[id]/sync-session', () => {
  beforeEach(() => {
    cleanupDb()
    ;(isLettaEnabled as unknown as Mock).mockReturnValue(true)
  })

  it('syncs session and returns learning counts', async () => {
    createTestAgent({ lettaAgentId: 'letta-abc' })
    const request = createRequest({ summary: 'We discussed project architecture and decided to use React.' })

    const response = await POST(request, {
      params: Promise.resolve({ id: 'clx1abc2def' }),
    })

    const { status, body } = await parseResponse<{
      success: boolean
      learnings: { persona: number; decisions: number; archival: number }
    }>(response)

    expect(status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.learnings.persona).toBe(1)
    expect(body.learnings.decisions).toBe(1)
    expect(body.learnings.archival).toBe(1)
  })

  it('returns 404 when agent not found', async () => {
    const request = createRequest({ summary: 'Some summary' })

    const response = await POST(request, {
      params: Promise.resolve({ id: 'nonexistent' }),
    })

    const { status, body } = await parseResponse<{ error: string }>(response)
    expect(status).toBe(404)
    expect(body.error).toBe('Agent not found')
  })

  it('returns 400 when agent has no lettaAgentId', async () => {
    createTestAgent({ lettaAgentId: null })
    const request = createRequest({ summary: 'Some summary' })

    const response = await POST(request, {
      params: Promise.resolve({ id: 'clx1abc2def' }),
    })

    const { status, body } = await parseResponse<{ error: string }>(response)
    expect(status).toBe(400)
    expect(body.error).toContain('Letta memory')
  })

  it('returns 503 when Letta is not configured', async () => {
    ;(isLettaEnabled as unknown as Mock).mockReturnValue(false)
    createTestAgent({ lettaAgentId: 'letta-abc' })
    const request = createRequest({ summary: 'Some summary' })

    const response = await POST(request, {
      params: Promise.resolve({ id: 'clx1abc2def' }),
    })

    const { status, body } = await parseResponse<{ error: string }>(response)
    expect(status).toBe(503)
    expect(body.error).toContain('Letta is not configured')
  })

  it('returns 400 when summary is missing', async () => {
    createTestAgent({ lettaAgentId: 'letta-abc' })
    const request = createRequest({})

    const response = await POST(request, {
      params: Promise.resolve({ id: 'clx1abc2def' }),
    })

    const { status, body } = await parseResponse<{ error: string }>(response)
    expect(status).toBe(400)
    expect(body.error).toContain('Missing or invalid summary')
  })
})
