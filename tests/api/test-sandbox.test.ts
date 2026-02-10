// =============================================================================
// Agent OS -- API Tests: /api/test (POST)
// =============================================================================
// Tests for the "Try It" sandbox endpoint.
// Source: src/app/api/test/route.ts
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getMockedPrisma,
  cleanupDb,
  createRequest,
} from '../helpers/db'
import { createMockAgentProject } from '../helpers/fixtures'
import * as claude from '@/lib/claude'

// ---------------------------------------------------------------------------
// Route handler imports
// ---------------------------------------------------------------------------

let POST: (req: Request) => Promise<Response>

beforeEach(async () => {
  cleanupDb()
  try {
    const mod = await import('@/app/api/test/route')
    POST = mod.POST as unknown as (req: Request) => Promise<Response>
  } catch {
    POST = async () =>
      new Response(JSON.stringify({ error: 'Not implemented' }), { status: 501 })
  }
})

// ===========================================================================
// POST /api/test
// ===========================================================================

describe('POST /api/test', () => {
  it('sends a test message and receives an agent response with metadata', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    // The test route expects Claude to return content + <metadata> tags
    vi.mocked(claude.chat).mockResolvedValue(
      "Hey! I'm Fixie, your support sidekick. How can I help?\n\n<metadata>\n{\"capabilitiesUsed\": [], \"guardrailsActive\": [\"prompt_injection_defense\"], \"tone\": \"casual-professional\"}\n</metadata>"
    )

    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/test', {
        projectId: agent.id,
        message: 'Hi there!',
        conversationHistory: [],
      })
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('role', 'agent')
    expect(body).toHaveProperty('content')
    expect(typeof body.content).toBe('string')
    expect((body.content as string).length).toBeGreaterThan(0)
    expect(body).toHaveProperty('metadata')
  })

  it('returns metadata with capabilitiesUsed, guardrailsActive, and tone', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    vi.mocked(claude.chat).mockResolvedValue(
      "Let me look up your account.\n\n<metadata>\n{\"capabilitiesUsed\": [\"account_lookup\"], \"guardrailsActive\": [\"no_data_sharing\"], \"tone\": \"friendly\"}\n</metadata>"
    )

    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/test', {
        projectId: agent.id,
        message: "I can't log into my account",
        conversationHistory: [],
      })
    )
    const body = (await res.json()) as Record<string, unknown>

    const metadata = body.metadata as Record<string, unknown>
    expect(metadata).toHaveProperty('capabilitiesUsed')
    expect(metadata).toHaveProperty('guardrailsActive')
    expect(metadata).toHaveProperty('tone')
    expect(Array.isArray(metadata.capabilitiesUsed)).toBe(true)
    expect(Array.isArray(metadata.guardrailsActive)).toBe(true)
  })

  it('strips <metadata> tags from the content', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    vi.mocked(claude.chat).mockResolvedValue(
      "Hello! How can I help?\n\n<metadata>\n{\"capabilitiesUsed\": [], \"guardrailsActive\": [], \"tone\": \"friendly\"}\n</metadata>"
    )

    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/test', {
        projectId: agent.id,
        message: 'Hello',
        conversationHistory: [],
      })
    )
    const body = (await res.json()) as Record<string, unknown>

    // Content should not contain the metadata tags
    expect(body.content).not.toContain('<metadata>')
    expect(body.content).not.toContain('</metadata>')
  })

  it('returns default metadata when Claude does not include metadata tags', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    // Claude returns plain text without metadata
    vi.mocked(claude.chat).mockResolvedValue(
      "Hey there! I'm Fixie. How can I help you today?"
    )

    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/test', {
        projectId: agent.id,
        message: 'Hi',
        conversationHistory: [],
      })
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(body).toHaveProperty('metadata')
    const metadata = body.metadata as Record<string, unknown>
    // Should have default empty arrays and the agent's tone
    expect(metadata).toHaveProperty('capabilitiesUsed')
    expect(metadata).toHaveProperty('guardrailsActive')
    expect(metadata).toHaveProperty('tone')
  })

  it('returns 404 if the project does not exist', async () => {
    const mocked = getMockedPrisma()
    mocked.agentProject.findUnique.mockResolvedValue(null)

    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/test', {
        projectId: 'nonexistent-id',
        message: 'Hello',
        conversationHistory: [],
      })
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(404)
    expect(body).toHaveProperty('error')
  })

  it('returns 400 when projectId is missing', async () => {
    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/test', {
        message: 'Hello',
        conversationHistory: [],
      })
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(400)
    expect(body).toHaveProperty('error')
  })

  it('returns 400 when message is missing', async () => {
    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/test', {
        projectId: 'some-id',
        conversationHistory: [],
      })
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(400)
    expect(body).toHaveProperty('error')
  })

  it('constructs a role-playing system prompt with agent identity and config', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    vi.mocked(claude.chat).mockResolvedValue('Test response')

    await POST(
      createRequest('POST', 'http://localhost:3000/api/test', {
        projectId: agent.id,
        message: 'Test message',
        conversationHistory: [],
      })
    )

    expect(claude.chat).toHaveBeenCalled()

    const callArgs = vi.mocked(claude.chat).mock.calls[0]
    const systemPrompt = callArgs[0]

    // The system prompt should include agent identity
    expect(systemPrompt).toContain('Fixie')
    // Should include mission info
    expect(systemPrompt).toContain('MISSION')
    // Should include guardrails
    expect(systemPrompt).toContain('GUARDRAILS')
    // Should instruct Claude to stay in character
    expect(systemPrompt).toContain('Stay in character')
  })

  it('maps "agent" role in conversation history to "assistant" for Claude', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    // Clear previous mock calls so we inspect only this call
    vi.mocked(claude.chat).mockClear()
    vi.mocked(claude.chat).mockResolvedValue('Follow up response')

    await POST(
      createRequest('POST', 'http://localhost:3000/api/test', {
        projectId: agent.id,
        message: "I can't log in",
        conversationHistory: [
          { role: 'user', content: 'Hi' },
          { role: 'agent', content: 'Hello! How can I help?' },
        ],
      })
    )

    const callArgs = vi.mocked(claude.chat).mock.calls[0]
    const messages = callArgs[1] as Array<{ role: string; content: string }>

    // "agent" should be mapped to "assistant" for the Claude API
    const agentMessage = messages.find((m) => m.content === 'Hello! How can I help?')
    expect(agentMessage).toBeTruthy()
    expect(agentMessage!.role).toBe('assistant')
  })

  it('handles Claude API errors with 500 status', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    vi.mocked(claude.chat).mockRejectedValue(new Error('API timeout'))

    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/test', {
        projectId: agent.id,
        message: 'Hello',
        conversationHistory: [],
      })
    )

    expect(res.status).toBe(500)
  })

  it('does not persist test conversations (ephemeral)', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    vi.mocked(claude.chat).mockResolvedValue('Test reply')

    await POST(
      createRequest('POST', 'http://localhost:3000/api/test', {
        projectId: agent.id,
        message: 'Testing the sandbox',
        conversationHistory: [],
      })
    )

    // The test endpoint should NOT call agentProject.update
    // (unlike /api/chat which persists conversations)
    expect(mocked.agentProject.update).not.toHaveBeenCalled()
  })
})
