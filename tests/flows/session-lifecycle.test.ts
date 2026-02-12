import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as chat } from '@/app/api/runtime/[slug]/chat/route'
import { GET as listSessions } from '@/app/api/agents/[id]/sessions/route'
import { GET as getSession } from '@/app/api/agents/[id]/sessions/[sessionId]/route'
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

describe('Flow: Session Lifecycle', () => {
  // Config with max 5 turns
  const config = {
    ...sampleAgentConfig,
    guardrails: {
      ...sampleAgentConfig.guardrails,
      resource_limits: { max_turns_per_session: 5 },
    },
  }
  const agent = createMockAgentProject({
    slug: 'fixie',
    config: JSON.stringify(config),
  })
  const deployment = createMockDeployment({
    agentId: agent.id,
    config: JSON.stringify(config),
  })

  let currentSession: ReturnType<typeof createMockChatSession>

  beforeEach(() => {
    cleanupDb()
    mockedProcessMessage.mockReset()

    currentSession = createMockChatSession({
      deploymentId: deployment.id,
      token: 'ses_lifecycle_token',
    })

    const mocked = getMockedPrisma()
    mocked.agentProject.findUnique.mockImplementation((args: any) => {
      if (args.where.id === agent.id || args.where.slug === agent.slug) {
        return Promise.resolve(agent)
      }
      return Promise.resolve(null)
    })
    mocked.deployment.findFirst.mockResolvedValue(deployment)
  })

  it('first message creates new session with turnCount 1', async () => {
    const mocked = getMockedPrisma()
    mocked.chatSession.create.mockResolvedValue(currentSession)
    mocked.chatSession.update.mockResolvedValue(currentSession)

    mockedProcessMessage.mockResolvedValue({
      response: { id: 'msg_1', role: 'assistant', content: 'Hello!', timestamp: new Date().toISOString() },
      sessionUpdates: { turnCount: 1, failedAttempts: 0, status: 'active' },
    })

    const req = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', { message: 'Hi' })
    const res = await chat(req as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { status, body } = await parseResponse<any>(res)

    expect(status).toBe(200)
    expect(body.session.turnCount).toBe(1)
    expect(body.session.status).toBe('active')
    expect(mocked.chatSession.create).toHaveBeenCalledOnce()
  })

  it('messages 2-4 increment turnCount', async () => {
    const mocked = getMockedPrisma()
    mocked.chatSession.findUnique.mockResolvedValue({
      ...currentSession,
      turnCount: 3,
      messages: '[]',
    })
    mocked.chatSession.update.mockResolvedValue(currentSession)

    mockedProcessMessage.mockResolvedValue({
      response: { id: 'msg_4', role: 'assistant', content: 'Turn 4', timestamp: new Date().toISOString() },
      sessionUpdates: { turnCount: 4, failedAttempts: 0, status: 'active' },
    })

    const req = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', {
      message: 'Message 4',
      sessionToken: currentSession.token,
    })
    const res = await chat(req as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { body } = await parseResponse<any>(res)

    expect(body.session.turnCount).toBe(4)
    expect(body.session.status).toBe('active')
  })

  it('turn 5 ends session with guardrailNotice', async () => {
    const mocked = getMockedPrisma()
    mocked.chatSession.findUnique.mockResolvedValue({
      ...currentSession,
      turnCount: 4,
      messages: '[]',
    })
    mocked.chatSession.update.mockResolvedValue(currentSession)

    mockedProcessMessage.mockResolvedValue({
      response: { id: 'msg_5', role: 'assistant', content: 'Last response', timestamp: new Date().toISOString() },
      sessionUpdates: { turnCount: 5, failedAttempts: 0, status: 'ended' },
      guardrailNotice: 'Session ended: maximum 5 turns reached.',
    })

    const req = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', {
      message: 'Turn 5',
      sessionToken: currentSession.token,
    })
    const res = await chat(req as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { body } = await parseResponse<any>(res)

    expect(body.session.status).toBe('ended')
    expect(body.guardrailNotice).toContain('5 turns')
  })

  it('further messages blocked after session end', async () => {
    const mocked = getMockedPrisma()
    mocked.chatSession.findUnique.mockResolvedValue({
      ...currentSession,
      turnCount: 5,
      status: 'ended',
      messages: '[]',
    })
    mocked.chatSession.update.mockResolvedValue(currentSession)

    mockedProcessMessage.mockResolvedValue({
      response: { id: 'msg_blocked', role: 'assistant', content: 'Session has ended', timestamp: new Date().toISOString(), metadata: { blocked: true } },
      sessionUpdates: { turnCount: 5, failedAttempts: 0, status: 'ended' },
      guardrailNotice: 'Session has ended',
    })

    const req = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', {
      message: 'One more',
      sessionToken: currentSession.token,
    })
    const res = await chat(req as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { body } = await parseResponse<any>(res)

    expect(body.guardrailNotice).toBeDefined()
    // processMessage was called but with ended status — guardrails block inside
    expect(mockedProcessMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'ended',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'One more',
      undefined
    )
  })

  it('new conversation (no token) creates fresh session', async () => {
    const mocked = getMockedPrisma()
    const freshSession = createMockChatSession({
      id: 'ses_fresh',
      token: 'ses_fresh_token',
      deploymentId: deployment.id,
    })
    mocked.chatSession.create.mockResolvedValue(freshSession)
    mocked.chatSession.update.mockResolvedValue(freshSession)

    mockedProcessMessage.mockResolvedValue({
      response: { id: 'msg_fresh', role: 'assistant', content: 'Fresh start!', timestamp: new Date().toISOString() },
      sessionUpdates: { turnCount: 1, failedAttempts: 0, status: 'active' },
    })

    const req = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', { message: 'Hello again' })
    const res = await chat(req as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { body } = await parseResponse<any>(res)

    expect(body.session.token).toBe('ses_fresh_token')
    expect(body.session.turnCount).toBe(1)
    expect(mocked.chatSession.create).toHaveBeenCalledOnce()
  })

  it('builder can list and view sessions', async () => {
    const mocked = getMockedPrisma()

    // List sessions
    mocked.deployment.findMany.mockResolvedValue([{ id: deployment.id }])
    const sessions = [
      createMockChatSession({
        id: 'ses_1',
        turnCount: 5,
        status: 'ended',
        messages: JSON.stringify([
          { id: 'msg_1', role: 'user', content: 'First session message', timestamp: '2026-02-10T13:00:00Z' },
        ]),
      }),
      createMockChatSession({
        id: 'ses_2',
        turnCount: 2,
        status: 'active',
        messages: JSON.stringify([
          { id: 'msg_2', role: 'user', content: 'Second session', timestamp: '2026-02-10T14:00:00Z' },
        ]),
      }),
    ]
    mocked.chatSession.findMany.mockResolvedValue(sessions)

    const listReq = createRequest('GET', `http://localhost/api/agents/${agent.id}/sessions`)
    const listRes = await listSessions(listReq as any, { params: Promise.resolve({ id: agent.id }) })
    const { body: listBody } = await parseResponse<any>(listRes)

    expect(listBody.sessions).toHaveLength(2)
    expect(listBody.sessions[0].turnCount).toBe(5)

    // View detail
    mocked.chatSession.findUnique.mockResolvedValue(sessions[0])
    mocked.deployment.findUnique.mockResolvedValue(deployment)

    const detailReq = createRequest('GET', `http://localhost/api/agents/${agent.id}/sessions/ses_1`)
    const detailRes = await getSession(detailReq as any, {
      params: Promise.resolve({ id: agent.id, sessionId: 'ses_1' }),
    })
    const { status, body: detailBody } = await parseResponse<any>(detailRes)

    expect(status).toBe(200)
    expect(detailBody.id).toBe('ses_1')
    expect(detailBody.turnCount).toBe(5)
    expect(detailBody.status).toBe('ended')
  })
})
