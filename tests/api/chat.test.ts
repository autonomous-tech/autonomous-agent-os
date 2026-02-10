// =============================================================================
// Agent OS -- API Tests: /api/chat (POST)
// =============================================================================
// Tests for the conversational builder endpoint.
// Source: src/app/api/chat/route.ts
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
    const mod = await import('@/app/api/chat/route')
    POST = mod.POST as unknown as (req: Request) => Promise<Response>
  } catch {
    POST = async () =>
      new Response(JSON.stringify({ error: 'Not implemented' }), { status: 501 })
  }
})

// ===========================================================================
// POST /api/chat
// ===========================================================================

describe('POST /api/chat', () => {
  it('sends a message and receives a reply with previewUpdates and quickReplies', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)
    mocked.agentProject.update.mockResolvedValue(agent)

    vi.mocked(claude.chat).mockResolvedValue(
      JSON.stringify({
        reply: 'Great! Let me help you define the mission.',
        previewUpdates: [
          { field: 'description', value: 'Customer support agent' },
        ],
        quickReplies: ['Sounds good', 'Let me think'],
        stageStatus: 'draft',
      })
    )

    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/chat', {
        projectId: agent.id,
        stage: 'mission',
        message: 'I want a customer support agent for my SaaS product',
      })
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('reply')
    expect(typeof body.reply).toBe('string')
    expect((body.reply as string).length).toBeGreaterThan(0)
    expect(body).toHaveProperty('previewUpdates')
    expect(body).toHaveProperty('quickReplies')
    expect(body).toHaveProperty('stageStatus')
  })

  it('returns 404 if the project does not exist', async () => {
    const mocked = getMockedPrisma()
    mocked.agentProject.findUnique.mockResolvedValue(null)

    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/chat', {
        projectId: 'nonexistent-id',
        stage: 'mission',
        message: 'Hello',
      })
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(404)
    expect(body).toHaveProperty('error')
  })

  it('returns 400 when projectId is missing', async () => {
    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/chat', {
        stage: 'mission',
        message: 'Hello',
      })
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(400)
    expect(body).toHaveProperty('error')
  })

  it('returns 400 when stage is missing', async () => {
    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/chat', {
        projectId: 'some-id',
        message: 'Hello',
      })
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(400)
    expect(body).toHaveProperty('error')
  })

  it('returns 400 when message is missing', async () => {
    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/chat', {
        projectId: 'some-id',
        stage: 'mission',
      })
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(400)
    expect(body).toHaveProperty('error')
  })

  it('calls claude.chat with a system prompt that includes stage-specific instructions', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)
    mocked.agentProject.update.mockResolvedValue(agent)

    vi.mocked(claude.chat).mockResolvedValue(
      JSON.stringify({
        reply: 'Mock reply',
        previewUpdates: [],
        quickReplies: [],
        stageStatus: 'draft',
      })
    )

    await POST(
      createRequest('POST', 'http://localhost:3000/api/chat', {
        projectId: agent.id,
        stage: 'mission',
        message: 'Tell me about the mission',
      })
    )

    expect(claude.chat).toHaveBeenCalled()

    const callArgs = vi.mocked(claude.chat).mock.calls[0]
    const systemPrompt = callArgs[0]

    // System prompt should include the base builder prompt
    expect(systemPrompt).toContain('Agent OS builder')
    // Should include mission stage instructions
    expect(systemPrompt).toContain('CURRENT STAGE: MISSION')
    // Should include response format instructions
    expect(systemPrompt).toContain('RESPONSE FORMAT')
  })

  it('includes the user message and conversation history in the messages array', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)
    mocked.agentProject.update.mockResolvedValue(agent)

    // Clear previous mock calls so we can inspect this call specifically
    vi.mocked(claude.chat).mockClear()
    vi.mocked(claude.chat).mockResolvedValue(
      JSON.stringify({
        reply: 'Understood!',
        previewUpdates: [],
        quickReplies: [],
        stageStatus: 'draft',
      })
    )

    const userMessage = 'I need an agent that handles billing'
    await POST(
      createRequest('POST', 'http://localhost:3000/api/chat', {
        projectId: agent.id,
        stage: 'mission',
        message: userMessage,
      })
    )

    const callArgs = vi.mocked(claude.chat).mock.calls[0]
    const messages = callArgs[1] as Array<{ role: string; content: string }>

    // The last message should be the user's message
    const lastMsg = messages[messages.length - 1]
    expect(lastMsg.role).toBe('user')
    expect(lastMsg.content).toBe(userMessage)
  })

  it('persists conversation history after a successful chat', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    let capturedUpdateData: Record<string, unknown> | null = null
    mocked.agentProject.update.mockImplementation(
      async (args: { data: Record<string, unknown> }) => {
        capturedUpdateData = args.data
        return { ...agent, ...args.data }
      }
    )

    vi.mocked(claude.chat).mockResolvedValue(
      JSON.stringify({
        reply: 'Here is your mission draft.',
        previewUpdates: [],
        quickReplies: [],
        stageStatus: 'draft',
      })
    )

    await POST(
      createRequest('POST', 'http://localhost:3000/api/chat', {
        projectId: agent.id,
        stage: 'mission',
        message: 'Build me a support agent',
      })
    )

    // The route should persist the conversation
    expect(mocked.agentProject.update).toHaveBeenCalled()
    expect(capturedUpdateData).toBeTruthy()

    const savedConversations = JSON.parse(
      capturedUpdateData!.conversations as string
    )
    expect(savedConversations.mission.length).toBeGreaterThan(0)
  })

  it('applies previewUpdates to the agent config', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    let capturedUpdateData: Record<string, unknown> | null = null
    mocked.agentProject.update.mockImplementation(
      async (args: { data: Record<string, unknown> }) => {
        capturedUpdateData = args.data
        return { ...agent, ...args.data }
      }
    )

    vi.mocked(claude.chat).mockResolvedValue(
      JSON.stringify({
        reply: 'Updated!',
        previewUpdates: [
          { field: 'description', value: 'A support agent for SaaS' },
          { field: 'tasks', value: ['Answer questions', 'Handle billing'] },
        ],
        quickReplies: [],
        stageStatus: 'draft',
      })
    )

    await POST(
      createRequest('POST', 'http://localhost:3000/api/chat', {
        projectId: agent.id,
        stage: 'mission',
        message: 'Build me a support agent',
      })
    )

    expect(capturedUpdateData).toBeTruthy()
    const savedConfig = JSON.parse(capturedUpdateData!.config as string)
    expect(savedConfig.mission.description).toBe('A support agent for SaaS')
    expect(savedConfig.mission.tasks).toEqual([
      'Answer questions',
      'Handle billing',
    ])
  })

  it('handles Claude returning non-JSON gracefully', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)
    mocked.agentProject.update.mockResolvedValue(agent)

    // Claude returns plain text instead of JSON
    vi.mocked(claude.chat).mockResolvedValue(
      'Sure, I can help you build a support agent. What kind of product do you have?'
    )

    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/chat', {
        projectId: agent.id,
        stage: 'mission',
        message: 'Hello',
      })
    )
    const body = (await res.json()) as Record<string, unknown>

    // Should wrap the raw text in the expected response format
    expect(res.status).toBe(200)
    expect(body).toHaveProperty('reply')
    expect(typeof body.reply).toBe('string')
  })

  it('handles Claude API errors with 500 status', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    vi.mocked(claude.chat).mockRejectedValue(new Error('Claude API unavailable'))

    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/chat', {
        projectId: agent.id,
        stage: 'mission',
        message: 'Hello',
      })
    )

    expect(res.status).toBe(500)
  })

  it('sets agent status to "building" after a chat interaction', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject({ status: 'draft' })
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    let capturedUpdateData: Record<string, unknown> | null = null
    mocked.agentProject.update.mockImplementation(
      async (args: { data: Record<string, unknown> }) => {
        capturedUpdateData = args.data
        return { ...agent, ...args.data }
      }
    )

    vi.mocked(claude.chat).mockResolvedValue(
      JSON.stringify({
        reply: 'Working on it.',
        previewUpdates: [],
        quickReplies: [],
        stageStatus: 'draft',
      })
    )

    await POST(
      createRequest('POST', 'http://localhost:3000/api/chat', {
        projectId: agent.id,
        stage: 'mission',
        message: 'Start building',
      })
    )

    expect(capturedUpdateData).toBeTruthy()
    expect(capturedUpdateData!.status).toBe('building')
  })
})
