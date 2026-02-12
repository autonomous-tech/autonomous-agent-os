import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as chat } from '@/app/api/runtime/[slug]/chat/route'
import { GET as getInfo } from '@/app/api/runtime/[slug]/route'
import { DELETE as pause } from '@/app/api/agents/[id]/deploy/route'
import { getMockedPrisma, cleanupDb, createRequest, parseResponse } from '../helpers/db'
import {
  createMockAgentProject,
  createMockDeployment,
  createMockChatSession,
  sampleAgentConfig,
  helixAgentConfig,
} from '../helpers/fixtures'

vi.mock('@/lib/runtime/engine', () => ({
  processMessage: vi.fn(),
}))

import { processMessage } from '@/lib/runtime/engine'

const mockedProcessMessage = vi.mocked(processMessage)

describe('Flow: Multi-Agent Isolation', () => {
  const agentA = createMockAgentProject({
    id: 'agent_a',
    slug: 'fixie',
    name: 'Fixie',
    config: JSON.stringify(sampleAgentConfig),
  })
  const agentB = createMockAgentProject({
    id: 'agent_b',
    slug: 'helix',
    name: 'Helix',
    config: JSON.stringify(helixAgentConfig),
  })

  const depA = createMockDeployment({ id: 'dep_a', agentId: 'agent_a', config: agentA.config, systemPrompt: 'You are Fixie.' })
  const depB = createMockDeployment({ id: 'dep_b', agentId: 'agent_b', config: agentB.config, systemPrompt: 'You are Helix.' })

  beforeEach(() => {
    cleanupDb()
    mockedProcessMessage.mockReset()

    const mocked = getMockedPrisma()

    // Route agent lookups by slug
    mocked.agentProject.findUnique.mockImplementation((args: any) => {
      if (args.where.slug === 'fixie' || args.where.id === 'agent_a') return Promise.resolve(agentA)
      if (args.where.slug === 'helix' || args.where.id === 'agent_b') return Promise.resolve(agentB)
      return Promise.resolve(null)
    })

    // Route deployment lookups by agentId
    mocked.deployment.findFirst.mockImplementation((args: any) => {
      if (args.where.agentId === 'agent_a' && args.where.status === 'active') return Promise.resolve(depA)
      if (args.where.agentId === 'agent_b' && args.where.status === 'active') return Promise.resolve(depB)
      return Promise.resolve(null)
    })
  })

  it('both agents are accessible independently', async () => {
    const infoA = await getInfo(
      createRequest('GET', 'http://localhost/api/runtime/fixie') as any,
      { params: Promise.resolve({ slug: 'fixie' }) }
    )
    const { body: bodyA } = await parseResponse<any>(infoA)
    expect(bodyA.agent.name).toBe('Fixie')

    const infoB = await getInfo(
      createRequest('GET', 'http://localhost/api/runtime/helix') as any,
      { params: Promise.resolve({ slug: 'helix' }) }
    )
    const { body: bodyB } = await parseResponse<any>(infoB)
    expect(bodyB.agent.name).toBe('Helix')
  })

  it('chat with Agent A uses Fixie system prompt', async () => {
    const mocked = getMockedPrisma()
    const sessionA = createMockChatSession({ id: 'ses_a', deploymentId: 'dep_a', token: 'token_a' })
    mocked.chatSession.create.mockResolvedValue(sessionA)
    mocked.chatSession.update.mockResolvedValue(sessionA)

    mockedProcessMessage.mockResolvedValue({
      response: { id: 'msg_a', role: 'assistant', content: 'Fixie here!', timestamp: new Date().toISOString() },
      sessionUpdates: { turnCount: 1, failedAttempts: 0, status: 'active' },
    })

    const req = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', { message: 'Help me' })
    await chat(req as any, { params: Promise.resolve({ slug: 'fixie' }) })

    // Verify processMessage was called with Fixie's system prompt
    const callArgs = mockedProcessMessage.mock.calls[0]
    expect(callArgs[0]).toBe('You are Fixie.')
  })

  it('chat with Agent B uses Helix system prompt', async () => {
    const mocked = getMockedPrisma()
    const sessionB = createMockChatSession({ id: 'ses_b', deploymentId: 'dep_b', token: 'token_b' })
    mocked.chatSession.create.mockResolvedValue(sessionB)
    mocked.chatSession.update.mockResolvedValue(sessionB)

    mockedProcessMessage.mockResolvedValue({
      response: { id: 'msg_b', role: 'assistant', content: 'Helix here!', timestamp: new Date().toISOString() },
      sessionUpdates: { turnCount: 1, failedAttempts: 0, status: 'active' },
    })

    const req = createRequest('POST', 'http://localhost/api/runtime/helix/chat', { message: 'Research this' })
    await chat(req as any, { params: Promise.resolve({ slug: 'helix' }) })

    const callArgs = mockedProcessMessage.mock.calls[0]
    expect(callArgs[0]).toBe('You are Helix.')
  })

  it('sessions are isolated between agents', async () => {
    const mocked = getMockedPrisma()
    const sessionA = createMockChatSession({ id: 'ses_a', deploymentId: 'dep_a', token: 'token_a' })
    const sessionB = createMockChatSession({ id: 'ses_b', deploymentId: 'dep_b', token: 'token_b' })

    mocked.chatSession.create
      .mockResolvedValueOnce(sessionA)
      .mockResolvedValueOnce(sessionB)
    mocked.chatSession.update.mockResolvedValue({})

    mockedProcessMessage.mockResolvedValue({
      response: { id: 'msg_r', role: 'assistant', content: 'Response', timestamp: new Date().toISOString() },
      sessionUpdates: { turnCount: 1, failedAttempts: 0, status: 'active' },
    })

    // Chat with A
    const reqA = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', { message: 'Hi A' })
    const resA = await chat(reqA as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { body: bodyA } = await parseResponse<any>(resA)

    // Chat with B
    const reqB = createRequest('POST', 'http://localhost/api/runtime/helix/chat', { message: 'Hi B' })
    const resB = await chat(reqB as any, { params: Promise.resolve({ slug: 'helix' }) })
    const { body: bodyB } = await parseResponse<any>(resB)

    // Different tokens, different deployment contexts
    expect(bodyA.session.token).toBe('token_a')
    expect(bodyB.session.token).toBe('token_b')
    expect(bodyA.session.token).not.toBe(bodyB.session.token)
  })

  it('pausing Agent A does not affect Agent B', async () => {
    const mocked = getMockedPrisma()

    // Pause Agent A
    mocked.deployment.findFirst.mockImplementation((args: any) => {
      if (args.where.agentId === 'agent_a' && args.where.status === 'active') return Promise.resolve(depA)
      if (args.where.agentId === 'agent_b' && args.where.status === 'active') return Promise.resolve(depB)
      return Promise.resolve(null)
    })
    mocked.deployment.update.mockResolvedValue({ ...depA, status: 'paused' })

    const pauseReq = createRequest('DELETE', 'http://localhost/api/agents/agent_a/deploy')
    const pauseRes = await pause(pauseReq as any, { params: Promise.resolve({ id: 'agent_a' }) })
    expect((await parseResponse(pauseRes)).status).toBe(200)

    // Now Agent A's deployment is paused — findFirst returns null for active
    mocked.deployment.findFirst.mockImplementation((args: any) => {
      if (args.where.agentId === 'agent_a') return Promise.resolve(null) // paused, not active
      if (args.where.agentId === 'agent_b' && args.where.status === 'active') return Promise.resolve(depB)
      return Promise.resolve(null)
    })

    // Agent A returns 404
    const infoA = await getInfo(
      createRequest('GET', 'http://localhost/api/runtime/fixie') as any,
      { params: Promise.resolve({ slug: 'fixie' }) }
    )
    expect((await parseResponse(infoA)).status).toBe(404)

    // Agent B still works
    const infoB = await getInfo(
      createRequest('GET', 'http://localhost/api/runtime/helix') as any,
      { params: Promise.resolve({ slug: 'helix' }) }
    )
    expect((await parseResponse(infoB)).status).toBe(200)
  })

  it('unknown agent slug returns 404 without affecting others', async () => {
    const infoUnknown = await getInfo(
      createRequest('GET', 'http://localhost/api/runtime/unknown') as any,
      { params: Promise.resolve({ slug: 'unknown' }) }
    )
    expect((await parseResponse(infoUnknown)).status).toBe(404)

    // Fixie still works
    const infoA = await getInfo(
      createRequest('GET', 'http://localhost/api/runtime/fixie') as any,
      { params: Promise.resolve({ slug: 'fixie' }) }
    )
    expect((await parseResponse(infoA)).status).toBe(200)
  })
})
