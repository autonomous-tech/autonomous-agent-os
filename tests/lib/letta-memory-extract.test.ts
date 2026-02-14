import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Mock } from 'vitest'

// Mock Letta client
vi.mock('@/lib/letta/client', () => ({
  isLettaEnabled: vi.fn().mockReturnValue(true),
  lettaClient: {
    agents: {
      blocks: {
        retrieve: vi.fn().mockResolvedValue({
          id: 'block-1',
          label: 'persona',
          value: 'Initial persona content.',
          limit: 5000,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'block-1',
          label: 'persona',
          value: 'Updated.',
          limit: 5000,
        }),
      },
      passages: {
        create: vi.fn().mockResolvedValue({ id: 'passage-1' }),
      },
    },
  },
}))

// Mock Claude chat
vi.mock('@/lib/claude', async () => {
  const actual = await vi.importActual('@/lib/claude')
  return {
    ...actual as Record<string, unknown>,
    chat: vi.fn().mockResolvedValue(
      JSON.stringify({
        persona: ['User likes TypeScript', 'User prefers dark mode'],
        decisions: ['Use React for frontend'],
        archival: ['Learned about MCP servers'],
      })
    ),
  }
})

import { chat } from '@/lib/claude'
import { lettaClient, isLettaEnabled } from '@/lib/letta/client'
import {
  extractMemoryFromSession,
  persistExtractedMemory,
  syncSessionMemory,
} from '@/lib/letta/memory-extract'
import { sampleAgentConfig } from '../helpers/fixtures'

describe('extractMemoryFromSession', () => {
  it('calls Claude with categorization prompt', async () => {
    const result = await extractMemoryFromSession(
      'We discussed TypeScript and dark mode preferences.',
      sampleAgentConfig
    )

    expect(chat).toHaveBeenCalledTimes(1)
    const callArgs = (chat as unknown as Mock).mock.calls[0]
    expect(callArgs[0]).toContain('memory categorization')
    expect(callArgs[1][0].content).toContain('Fixie')
    expect(callArgs[1][0].content).toContain('TypeScript')
  })

  it('returns categorized learnings', async () => {
    const result = await extractMemoryFromSession(
      'Test summary',
      sampleAgentConfig
    )

    expect(result.persona).toEqual(['User likes TypeScript', 'User prefers dark mode'])
    expect(result.decisions).toEqual(['Use React for frontend'])
    expect(result.archival).toEqual(['Learned about MCP servers'])
  })

  it('returns empty arrays when Claude response is malformed', async () => {
    ;(chat as unknown as Mock).mockResolvedValueOnce('not valid json')

    const result = await extractMemoryFromSession(
      'Test summary',
      sampleAgentConfig
    )

    expect(result.persona).toEqual([])
    expect(result.decisions).toEqual([])
    expect(result.archival).toEqual([])
  })

  it('strips markdown code fences from Claude response', async () => {
    ;(chat as unknown as Mock).mockResolvedValueOnce(
      '```json\n{"persona":["test"],"decisions":[],"archival":[]}\n```'
    )

    const result = await extractMemoryFromSession(
      'Test summary',
      sampleAgentConfig
    )

    expect(result.persona).toEqual(['test'])
  })
})

describe('persistExtractedMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(isLettaEnabled as unknown as Mock).mockReturnValue(true)
  })

  it('appends persona learnings to persona block', async () => {
    await persistExtractedMemory('letta-123', {
      persona: ['Likes TypeScript'],
      decisions: [],
      archival: [],
    })

    expect(lettaClient!.agents.blocks.retrieve).toHaveBeenCalledWith('persona', {
      agent_id: 'letta-123',
    })
    expect(lettaClient!.agents.blocks.update).toHaveBeenCalledWith('persona', {
      agent_id: 'letta-123',
      value: 'Initial persona content.\nLikes TypeScript',
    })
  })

  it('inserts archival learnings as passages', async () => {
    await persistExtractedMemory('letta-123', {
      persona: [],
      decisions: [],
      archival: ['Pattern: use MCP for tools', 'Pattern: use Zod for schemas'],
    })

    expect(lettaClient!.agents.passages.create).toHaveBeenCalledTimes(2)
    expect(lettaClient!.agents.passages.create).toHaveBeenCalledWith(
      'letta-123',
      { text: 'Pattern: use MCP for tools', tags: ['session-extract'] }
    )
  })

  it('throws when Letta is not enabled', async () => {
    ;(isLettaEnabled as unknown as Mock).mockReturnValue(false)

    await expect(
      persistExtractedMemory('letta-123', {
        persona: [],
        decisions: [],
        archival: [],
      })
    ).rejects.toThrow('Letta is not enabled')
  })

  it('skips persona update when no persona learnings', async () => {
    await persistExtractedMemory('letta-123', {
      persona: [],
      decisions: [],
      archival: [],
    })

    expect(lettaClient!.agents.blocks.retrieve).not.toHaveBeenCalled()
    expect(lettaClient!.agents.blocks.update).not.toHaveBeenCalled()
  })
})

describe('syncSessionMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(isLettaEnabled as unknown as Mock).mockReturnValue(true)
    // Reset the chat mock
    ;(chat as unknown as Mock).mockResolvedValue(
      JSON.stringify({
        persona: ['User prefers tabs'],
        decisions: [],
        archival: ['Learned about hooks'],
      })
    )
    // Reset the blocks mock
    ;(lettaClient!.agents.blocks.retrieve as unknown as Mock).mockResolvedValue({
      id: 'block-1',
      label: 'persona',
      value: 'Initial persona content.',
      limit: 5000,
    })
  })

  it('extracts and persists memory', async () => {
    const result = await syncSessionMemory(
      'letta-123',
      'Discussion about code formatting preferences.',
      sampleAgentConfig
    )

    expect(result.persona).toEqual(['User prefers tabs'])
    expect(result.archival).toEqual(['Learned about hooks'])
    // Should have persisted
    expect(lettaClient!.agents.blocks.update).toHaveBeenCalled()
    expect(lettaClient!.agents.passages.create).toHaveBeenCalled()
  })

  it('skips persistence when no learnings', async () => {
    ;(chat as unknown as Mock).mockResolvedValueOnce(
      JSON.stringify({ persona: [], decisions: [], archival: [] })
    )

    const result = await syncSessionMemory(
      'letta-123',
      'Brief chat with no actionable info.',
      sampleAgentConfig
    )

    expect(result.persona).toEqual([])
    expect(lettaClient!.agents.blocks.retrieve).not.toHaveBeenCalled()
    expect(lettaClient!.agents.passages.create).not.toHaveBeenCalled()
  })
})
