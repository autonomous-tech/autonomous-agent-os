import { describe, it, expect, beforeEach } from 'vitest'
import { GET as listSessions } from '@/app/api/agents/[id]/sessions/route'
import { GET as getSession } from '@/app/api/agents/[id]/sessions/[sessionId]/route'
import { getMockedPrisma, cleanupDb, createRequest, parseResponse } from '../helpers/db'
import {
  createMockAgentProject,
  createMockDeployment,
  createMockChatSession,
} from '../helpers/fixtures'

describe('Sessions API', () => {
  const agent = createMockAgentProject()
  const deployment = createMockDeployment({ agentId: agent.id })

  beforeEach(() => {
    cleanupDb()
    const mocked = getMockedPrisma()
    mocked.agentProject.findUnique.mockImplementation(
      (args: { where: { id?: string } }) => {
        if (args.where.id === agent.id) return Promise.resolve(agent)
        return Promise.resolve(null)
      }
    )
  })

  describe('GET /api/agents/[id]/sessions (list)', () => {
    it('returns sessions with summaries', async () => {
      const mocked = getMockedPrisma()
      mocked.deployment.findMany.mockResolvedValue([{ id: deployment.id }])

      const session = createMockChatSession({
        turnCount: 3,
        status: 'active',
        messages: JSON.stringify([
          { id: 'msg_1', role: 'user', content: 'Hello there!', timestamp: '2026-02-10T13:00:00Z' },
          { id: 'msg_2', role: 'assistant', content: 'Hi!', timestamp: '2026-02-10T13:00:01Z' },
        ]),
      })
      mocked.chatSession.findMany.mockResolvedValue([session])

      const request = createRequest('GET', `http://localhost/api/agents/${agent.id}/sessions`)
      const response = await listSessions(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { status, body } = await parseResponse<any>(response)

      expect(status).toBe(200)
      expect(body.sessions).toHaveLength(1)
      expect(body.sessions[0].id).toBe(session.id)
      expect(body.sessions[0].turnCount).toBe(3)
      expect(body.sessions[0].status).toBe('active')
      expect(body.sessions[0].firstMessage).toBe('Hello there!')
    })

    it('returns empty array when no sessions', async () => {
      const mocked = getMockedPrisma()
      mocked.deployment.findMany.mockResolvedValue([{ id: deployment.id }])
      mocked.chatSession.findMany.mockResolvedValue([])

      const request = createRequest('GET', `http://localhost/api/agents/${agent.id}/sessions`)
      const response = await listSessions(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { status, body } = await parseResponse<any>(response)

      expect(status).toBe(200)
      expect(body.sessions).toEqual([])
    })

    it('returns empty array when no deployments exist', async () => {
      const mocked = getMockedPrisma()
      mocked.deployment.findMany.mockResolvedValue([])

      const request = createRequest('GET', `http://localhost/api/agents/${agent.id}/sessions`)
      const response = await listSessions(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { status, body } = await parseResponse<any>(response)

      expect(status).toBe(200)
      expect(body.sessions).toEqual([])
      // chatSession.findMany should NOT have been called since there are no deployments
      expect(mocked.chatSession.findMany).not.toHaveBeenCalled()
    })

    it('returns 404 for unknown agent', async () => {
      const request = createRequest('GET', 'http://localhost/api/agents/unknown/sessions')
      const response = await listSessions(request as any, { params: Promise.resolve({ id: 'unknown' }) })
      const { status, body } = await parseResponse<any>(response)

      expect(status).toBe(404)
      expect(body.error).toBe('Agent not found')
    })

    it('truncates firstMessage to 100 chars', async () => {
      const mocked = getMockedPrisma()
      mocked.deployment.findMany.mockResolvedValue([{ id: deployment.id }])

      const longMessage = 'A'.repeat(200)
      const session = createMockChatSession({
        messages: JSON.stringify([
          { id: 'msg_1', role: 'user', content: longMessage, timestamp: '2026-02-10T13:00:00Z' },
        ]),
      })
      mocked.chatSession.findMany.mockResolvedValue([session])

      const request = createRequest('GET', `http://localhost/api/agents/${agent.id}/sessions`)
      const response = await listSessions(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { body } = await parseResponse<any>(response)

      expect(body.sessions[0].firstMessage).toHaveLength(100)
    })
  })

  describe('GET /api/agents/[id]/sessions/[sessionId] (detail)', () => {
    it('returns full session detail', async () => {
      const mocked = getMockedPrisma()
      const messages = [
        { id: 'msg_1', role: 'user', content: 'Hello', timestamp: '2026-02-10T13:00:00Z' },
        { id: 'msg_2', role: 'assistant', content: 'Hi there!', timestamp: '2026-02-10T13:00:01Z' },
      ]
      const session = createMockChatSession({
        messages: JSON.stringify(messages),
        turnCount: 1,
        metadata: JSON.stringify({ source: 'web' }),
      })
      mocked.chatSession.findUnique.mockResolvedValue(session)
      mocked.deployment.findUnique.mockResolvedValue(deployment)

      const request = createRequest('GET', `http://localhost/api/agents/${agent.id}/sessions/${session.id}`)
      const response = await getSession(request as any, {
        params: Promise.resolve({ id: agent.id, sessionId: session.id }),
      })
      const { status, body } = await parseResponse<any>(response)

      expect(status).toBe(200)
      expect(body.id).toBe(session.id)
      expect(body.turnCount).toBe(1)
      expect(body.messages).toHaveLength(2)
      expect(body.messages[0].content).toBe('Hello')
      expect(body.metadata).toEqual({ source: 'web' })
    })

    it('returns 404 for unknown session', async () => {
      const mocked = getMockedPrisma()
      mocked.chatSession.findUnique.mockResolvedValue(null)

      const request = createRequest('GET', `http://localhost/api/agents/${agent.id}/sessions/unknown`)
      const response = await getSession(request as any, {
        params: Promise.resolve({ id: agent.id, sessionId: 'unknown' }),
      })
      const { status, body } = await parseResponse<any>(response)

      expect(status).toBe(404)
      expect(body.error).toBe('Session not found')
    })

    it('returns 404 when session belongs to different agent', async () => {
      const mocked = getMockedPrisma()
      const session = createMockChatSession()
      mocked.chatSession.findUnique.mockResolvedValue(session)

      // Deployment belongs to a different agent
      const otherDeployment = createMockDeployment({
        id: 'dep_other',
        agentId: 'different_agent_id',
      })
      mocked.deployment.findUnique.mockResolvedValue(otherDeployment)

      const request = createRequest('GET', `http://localhost/api/agents/${agent.id}/sessions/${session.id}`)
      const response = await getSession(request as any, {
        params: Promise.resolve({ id: agent.id, sessionId: session.id }),
      })
      const { status, body } = await parseResponse<any>(response)

      expect(status).toBe(404)
      expect(body.error).toBe('Session not found')
    })

    it('returns 404 when deployment not found', async () => {
      const mocked = getMockedPrisma()
      const session = createMockChatSession()
      mocked.chatSession.findUnique.mockResolvedValue(session)
      mocked.deployment.findUnique.mockResolvedValue(null)

      const request = createRequest('GET', `http://localhost/api/agents/${agent.id}/sessions/${session.id}`)
      const response = await getSession(request as any, {
        params: Promise.resolve({ id: agent.id, sessionId: session.id }),
      })
      const { status, body } = await parseResponse<any>(response)

      expect(status).toBe(404)
      expect(body.error).toBe('Session not found')
    })

    it('returns 404 when agent not found', async () => {
      const request = createRequest('GET', 'http://localhost/api/agents/unknown/sessions/ses_123')
      const response = await getSession(request as any, {
        params: Promise.resolve({ id: 'unknown', sessionId: 'ses_123' }),
      })
      const { status, body } = await parseResponse<any>(response)

      expect(status).toBe(404)
      expect(body.error).toBe('Agent not found')
    })
  })
})
