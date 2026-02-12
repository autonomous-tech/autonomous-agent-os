import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/runtime/[slug]/chat/route'
import { getMockedPrisma, cleanupDb, createRequest, parseResponse } from '../helpers/db'
import {
  createMockAgentProject,
  createMockDeployment,
  createMockChatSession,
  sampleAgentConfig,
} from '../helpers/fixtures'

vi.mock('@/lib/runtime/engine', () => ({
  processMessage: vi.fn(),
}))

import { processMessage } from '@/lib/runtime/engine'

const mockedProcessMessage = vi.mocked(processMessage)

describe('Runtime Chat API — POST /api/runtime/[slug]/chat', () => {
  const agent = createMockAgentProject({ slug: 'fixie' })
  const deployment = createMockDeployment({ agentId: agent.id })
  const existingSession = createMockChatSession({ deploymentId: deployment.id })

  function defaultProcessResult(overrides = {}) {
    return {
      response: {
        id: 'msg_test123',
        role: 'assistant' as const,
        content: 'Hello! How can I help?',
        timestamp: new Date().toISOString(),
      },
      sessionUpdates: { turnCount: 1, failedAttempts: 0, status: 'active' as const },
      ...overrides,
    }
  }

  beforeEach(() => {
    cleanupDb()
    mockedProcessMessage.mockReset()
    mockedProcessMessage.mockResolvedValue(defaultProcessResult())

    const mocked = getMockedPrisma()
    mocked.agentProject.findUnique.mockResolvedValue(agent)
    mocked.deployment.findFirst.mockResolvedValue(deployment)
  })

  it('creates a new session when no token provided', async () => {
    const mocked = getMockedPrisma()
    const newSession = createMockChatSession({
      deploymentId: deployment.id,
      token: 'ses_new_token',
    })
    mocked.chatSession.create.mockResolvedValue(newSession)
    mocked.chatSession.update.mockResolvedValue(newSession)

    const request = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', {
      message: 'Hello',
    })
    const response = await POST(request as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { status, body } = await parseResponse<any>(response)

    expect(status).toBe(200)
    expect(body.message).toBeDefined()
    expect(body.message.role).toBe('assistant')
    expect(body.session.token).toBe('ses_new_token')
    expect(body.session.turnCount).toBe(1)
    expect(mocked.chatSession.create).toHaveBeenCalledOnce()
  })

  it('reuses existing session when token provided', async () => {
    const mocked = getMockedPrisma()
    mocked.chatSession.findUnique.mockResolvedValue(existingSession)
    mocked.chatSession.update.mockResolvedValue(existingSession)

    const request = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', {
      message: 'Follow-up',
      sessionToken: existingSession.token,
    })
    const response = await POST(request as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { status, body } = await parseResponse<any>(response)

    expect(status).toBe(200)
    expect(body.session.token).toBe(existingSession.token)
    expect(mocked.chatSession.create).not.toHaveBeenCalled()
  })

  it('sets httpOnly cookie for new sessions', async () => {
    const mocked = getMockedPrisma()
    const newSession = createMockChatSession({ token: 'ses_cookie_test' })
    mocked.chatSession.create.mockResolvedValue(newSession)
    mocked.chatSession.update.mockResolvedValue(newSession)

    const request = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', {
      message: 'Hello',
    })
    const response = await POST(request as any, { params: Promise.resolve({ slug: 'fixie' }) })

    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toContain('agent_session=ses_cookie_test')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Path=/a/fixie')
  })

  it('does not set cookie for existing sessions', async () => {
    const mocked = getMockedPrisma()
    mocked.chatSession.findUnique.mockResolvedValue(existingSession)
    mocked.chatSession.update.mockResolvedValue(existingSession)

    const request = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', {
      message: 'Follow-up',
      sessionToken: existingSession.token,
    })
    const response = await POST(request as any, { params: Promise.resolve({ slug: 'fixie' }) })

    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toBeNull()
  })

  it('returns 404 for unknown slug', async () => {
    const mocked = getMockedPrisma()
    mocked.agentProject.findUnique.mockResolvedValue(null)

    const request = createRequest('POST', 'http://localhost/api/runtime/unknown/chat', {
      message: 'Hello',
    })
    const response = await POST(request as any, { params: Promise.resolve({ slug: 'unknown' }) })
    const { status, body } = await parseResponse<any>(response)

    expect(status).toBe(404)
    expect(body.error).toBe('Agent not found')
  })

  it('returns 404 for paused deployment', async () => {
    const mocked = getMockedPrisma()
    mocked.deployment.findFirst.mockResolvedValue(null)

    const request = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', {
      message: 'Hello',
    })
    const response = await POST(request as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { status, body } = await parseResponse<any>(response)

    expect(status).toBe(404)
    expect(body.error).toBe('Agent is not currently deployed')
  })

  it('returns 400 for empty message', async () => {
    const request = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', {
      message: '',
    })
    const response = await POST(request as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { status } = await parseResponse(response)

    expect(status).toBe(400)
  })

  it('returns 400 for message exceeding 10k chars', async () => {
    const request = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', {
      message: 'x'.repeat(10001),
    })
    const response = await POST(request as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { status, body } = await parseResponse<any>(response)

    expect(status).toBe(400)
    expect(body.error).toContain('maximum length')
  })

  it('returns 400 for non-string message', async () => {
    const request = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', {
      message: 42,
    })
    const response = await POST(request as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { status } = await parseResponse(response)

    expect(status).toBe(400)
  })

  it('returns guardrailNotice when session ended by turn limit', async () => {
    const mocked = getMockedPrisma()
    const newSession = createMockChatSession()
    mocked.chatSession.create.mockResolvedValue(newSession)
    mocked.chatSession.update.mockResolvedValue(newSession)

    mockedProcessMessage.mockResolvedValue(
      defaultProcessResult({
        sessionUpdates: { turnCount: 50, failedAttempts: 0, status: 'ended' },
        guardrailNotice: 'Session ended: maximum 50 turns reached.',
      })
    )

    const request = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', {
      message: 'Last message',
    })
    const response = await POST(request as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { status, body } = await parseResponse<any>(response)

    expect(status).toBe(200)
    expect(body.guardrailNotice).toContain('maximum 50 turns')
    expect(body.session.status).toBe('ended')
  })

  it('updates messages array correctly', async () => {
    const mocked = getMockedPrisma()
    const sessionWithHistory = createMockChatSession({
      messages: JSON.stringify([
        { id: 'msg_1', role: 'user', content: 'Hi', timestamp: '2026-02-10T13:00:00Z' },
        { id: 'msg_2', role: 'assistant', content: 'Hello!', timestamp: '2026-02-10T13:00:01Z' },
      ]),
      turnCount: 1,
    })
    mocked.chatSession.findUnique.mockResolvedValue(sessionWithHistory)
    mocked.chatSession.update.mockResolvedValue(sessionWithHistory)

    const request = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', {
      message: 'How are you?',
      sessionToken: sessionWithHistory.token,
    })
    await POST(request as any, { params: Promise.resolve({ slug: 'fixie' }) })

    const updateCall = mocked.chatSession.update.mock.calls[0][0]
    const updatedMessages = JSON.parse(updateCall.data.messages)

    // Should have: 2 existing + 1 user + 1 assistant = 4
    expect(updatedMessages).toHaveLength(4)
    expect(updatedMessages[2].role).toBe('user')
    expect(updatedMessages[2].content).toBe('How are you?')
    expect(updatedMessages[3].role).toBe('assistant')
  })

  it('returns maxTurns from config in session info', async () => {
    const mocked = getMockedPrisma()
    const newSession = createMockChatSession()
    mocked.chatSession.create.mockResolvedValue(newSession)
    mocked.chatSession.update.mockResolvedValue(newSession)

    const request = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', {
      message: 'Hello',
    })
    const response = await POST(request as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { body } = await parseResponse<any>(response)

    // sampleAgentConfig has max_turns_per_session: 50
    expect(body.session.maxTurns).toBe(50)
  })
})
