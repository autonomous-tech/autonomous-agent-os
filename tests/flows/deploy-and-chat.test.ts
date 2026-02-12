import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as deploy } from '@/app/api/agents/[id]/deploy/route'
import { GET as getInfo } from '@/app/api/runtime/[slug]/route'
import { POST as chat } from '@/app/api/runtime/[slug]/chat/route'
import { getMockedPrisma, cleanupDb, createRequest, parseResponse } from '../helpers/db'
import {
  createMockAgentProject,
  createMockDeployment,
  createMockChatSession,
  sampleAgentConfig,
  sampleStageData,
} from '../helpers/fixtures'

vi.mock('@/lib/runtime/engine', () => ({
  processMessage: vi.fn(),
}))

import { processMessage } from '@/lib/runtime/engine'

const mockedProcessMessage = vi.mocked(processMessage)

describe('Flow: Deploy and Chat', () => {
  const agent = createMockAgentProject({
    slug: 'fixie',
    config: JSON.stringify(sampleAgentConfig),
    stages: JSON.stringify(sampleStageData),
  })

  let deploymentV1: ReturnType<typeof createMockDeployment>
  let sessionCounter = 0

  beforeEach(() => {
    cleanupDb()
    sessionCounter = 0
    mockedProcessMessage.mockReset()

    deploymentV1 = createMockDeployment({ agentId: agent.id, version: 1 })

    const mocked = getMockedPrisma()

    // Agent is always findable by id and slug
    mocked.agentProject.findUnique.mockImplementation((args: any) => {
      if (args.where.id === agent.id || args.where.slug === agent.slug) {
        return Promise.resolve(agent)
      }
      return Promise.resolve(null)
    })
  })

  it('complete lifecycle: deploy → get info → chat → follow-up', async () => {
    const mocked = getMockedPrisma()

    // Step 1: Deploy
    mocked.deployment.findMany.mockResolvedValue([])
    mocked.deployment.findFirst.mockResolvedValue(null)
    mocked.deployment.create.mockResolvedValue(deploymentV1)
    mocked.agentProject.update.mockResolvedValue({ ...agent, status: 'deployed' })

    const deployReq = createRequest('POST', `http://localhost/api/agents/${agent.id}/deploy`)
    const deployRes = await deploy(deployReq as any, { params: Promise.resolve({ id: agent.id }) })
    const { status: deployStatus, body: deployBody } = await parseResponse<any>(deployRes)

    expect(deployStatus).toBe(200)
    expect(deployBody.deployment.version).toBe(1)
    expect(deployBody.publicUrl).toBe('/a/fixie')

    // Step 2: Get info
    mocked.deployment.findFirst.mockResolvedValue(deploymentV1)

    const infoReq = createRequest('GET', 'http://localhost/api/runtime/fixie')
    const infoRes = await getInfo(infoReq as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { status: infoStatus, body: infoBody } = await parseResponse<any>(infoRes)

    expect(infoStatus).toBe(200)
    expect(infoBody.agent.name).toBe('Fixie')
    expect(infoBody.maxTurns).toBe(50)

    // Step 3: First chat (no token)
    const session1 = createMockChatSession({
      id: 'ses_1',
      deploymentId: deploymentV1.id,
      token: 'ses_token_1',
    })
    mocked.chatSession.create.mockResolvedValue(session1)
    mocked.chatSession.update.mockResolvedValue(session1)

    mockedProcessMessage.mockResolvedValue({
      response: { id: 'msg_r1', role: 'assistant', content: 'Hello! How can I help?', timestamp: new Date().toISOString() },
      sessionUpdates: { turnCount: 1, failedAttempts: 0, status: 'active' },
    })

    const chatReq1 = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', {
      message: 'I need help with billing',
    })
    const chatRes1 = await chat(chatReq1 as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { status: chatStatus1, body: chatBody1 } = await parseResponse<any>(chatRes1)

    expect(chatStatus1).toBe(200)
    expect(chatBody1.session.turnCount).toBe(1)
    expect(chatBody1.session.token).toBe('ses_token_1')
    expect(mocked.chatSession.create).toHaveBeenCalledOnce()

    // Step 4: Follow-up chat (with token)
    mocked.chatSession.findUnique.mockResolvedValue({
      ...session1,
      turnCount: 1,
      messages: JSON.stringify([
        { id: 'msg_u1', role: 'user', content: 'I need help with billing', timestamp: new Date().toISOString() },
        { id: 'msg_r1', role: 'assistant', content: 'Hello! How can I help?', timestamp: new Date().toISOString() },
      ]),
    })

    mockedProcessMessage.mockResolvedValue({
      response: { id: 'msg_r2', role: 'assistant', content: 'Let me look into that.', timestamp: new Date().toISOString() },
      sessionUpdates: { turnCount: 2, failedAttempts: 0, status: 'active' },
    })

    const chatReq2 = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', {
      message: 'Can I get a refund?',
      sessionToken: 'ses_token_1',
    })
    const chatRes2 = await chat(chatReq2 as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { status: chatStatus2, body: chatBody2 } = await parseResponse<any>(chatRes2)

    expect(chatStatus2).toBe(200)
    expect(chatBody2.session.turnCount).toBe(2)

    // Verify history was passed to processMessage
    const processCall = mockedProcessMessage.mock.calls[1]
    expect(processCall[5]).toHaveLength(2) // history array
  })

  it('deploy with invalid config returns 400', async () => {
    const invalidAgent = createMockAgentProject({
      id: 'invalid_agent',
      config: JSON.stringify({ mission: {} }),
      stages: JSON.stringify(sampleStageData),
    })
    const mocked = getMockedPrisma()
    mocked.agentProject.findUnique.mockImplementation((args: any) => {
      if (args.where.id === 'invalid_agent') return Promise.resolve(invalidAgent)
      return Promise.resolve(null)
    })

    const req = createRequest('POST', 'http://localhost/api/agents/invalid_agent/deploy')
    const res = await deploy(req as any, { params: Promise.resolve({ id: 'invalid_agent' }) })
    const { status } = await parseResponse(res)

    expect(status).toBe(400)
  })

  it('chat with empty message returns 400', async () => {
    const mocked = getMockedPrisma()
    mocked.deployment.findFirst.mockResolvedValue(deploymentV1)

    const req = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', {
      message: '',
    })
    const res = await chat(req as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { status } = await parseResponse(res)

    expect(status).toBe(400)
  })

  it('session state consistency across calls', async () => {
    const mocked = getMockedPrisma()
    mocked.deployment.findFirst.mockResolvedValue(deploymentV1)

    const session = createMockChatSession({ token: 'ses_consistent' })
    mocked.chatSession.create.mockResolvedValue(session)
    mocked.chatSession.update.mockResolvedValue(session)

    mockedProcessMessage.mockResolvedValue({
      response: { id: 'msg_1', role: 'assistant', content: 'Hi!', timestamp: new Date().toISOString() },
      sessionUpdates: { turnCount: 1, failedAttempts: 0, status: 'active' },
    })

    const req1 = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', { message: 'Hello' })
    const res1 = await chat(req1 as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { body: body1 } = await parseResponse<any>(res1)

    expect(body1.session.token).toBe('ses_consistent')
    expect(body1.session.status).toBe('active')
    expect(body1.session.turnCount).toBe(1)
  })
})
