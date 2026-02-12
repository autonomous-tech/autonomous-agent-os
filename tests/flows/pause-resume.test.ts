import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as deploy, GET as getDeployment, DELETE as pause, PATCH as resume } from '@/app/api/agents/[id]/deploy/route'
import { GET as getInfo } from '@/app/api/runtime/[slug]/route'
import { POST as chat } from '@/app/api/runtime/[slug]/chat/route'
import { getMockedPrisma, cleanupDb, createRequest, parseResponse } from '../helpers/db'
import {
  createMockAgentProject,
  createMockDeployment,
  sampleAgentConfig,
  sampleStageData,
} from '../helpers/fixtures'

vi.mock('@/lib/runtime/engine', () => ({
  processMessage: vi.fn(),
}))

import { processMessage } from '@/lib/runtime/engine'

const mockedProcessMessage = vi.mocked(processMessage)

describe('Flow: Pause and Resume', () => {
  const agent = createMockAgentProject({
    slug: 'fixie',
    config: JSON.stringify(sampleAgentConfig),
    stages: JSON.stringify(sampleStageData),
  })
  const dep = createMockDeployment({ agentId: agent.id, version: 1 })

  beforeEach(() => {
    cleanupDb()
    mockedProcessMessage.mockReset()

    const mocked = getMockedPrisma()
    mocked.agentProject.findUnique.mockImplementation((args: any) => {
      if (args.where.id === agent.id || args.where.slug === agent.slug) {
        return Promise.resolve(agent)
      }
      return Promise.resolve(null)
    })
  })

  it('deploy → active → pause → paused → resume → active', async () => {
    const mocked = getMockedPrisma()

    // Step 1: Deploy
    mocked.deployment.findMany.mockResolvedValue([])
    mocked.deployment.findFirst.mockResolvedValue(null)
    mocked.deployment.create.mockResolvedValue(dep)
    mocked.agentProject.update.mockResolvedValue({ ...agent, status: 'deployed' })

    const deployReq = createRequest('POST', `http://localhost/api/agents/${agent.id}/deploy`)
    const deployRes = await deploy(deployReq as any, { params: Promise.resolve({ id: agent.id }) })
    expect((await parseResponse(deployRes)).status).toBe(200)

    // Step 2: Verify active
    mocked.deployment.findFirst.mockResolvedValue(dep)

    const infoReq = createRequest('GET', 'http://localhost/api/runtime/fixie')
    const infoRes = await getInfo(infoReq as any, { params: Promise.resolve({ slug: 'fixie' }) })
    expect((await parseResponse(infoRes)).status).toBe(200)

    // Step 3: Pause
    mocked.deployment.findFirst.mockResolvedValue(dep) // active deployment found
    mocked.deployment.update.mockResolvedValue({ ...dep, status: 'paused' })

    const pauseReq = createRequest('DELETE', `http://localhost/api/agents/${agent.id}/deploy`)
    const pauseRes = await pause(pauseReq as any, { params: Promise.resolve({ id: agent.id }) })
    const { status: pauseStatus, body: pauseBody } = await parseResponse<any>(pauseRes)

    expect(pauseStatus).toBe(200)
    expect(pauseBody.status).toBe('paused')

    // Step 4: Runtime returns 404 when paused
    mocked.deployment.findFirst.mockResolvedValue(null) // no active deployment

    const pausedInfoReq = createRequest('GET', 'http://localhost/api/runtime/fixie')
    const pausedInfoRes = await getInfo(pausedInfoReq as any, { params: Promise.resolve({ slug: 'fixie' }) })
    expect((await parseResponse(pausedInfoRes)).status).toBe(404)

    // Step 5: Chat returns 404 when paused
    const chatReq = createRequest('POST', 'http://localhost/api/runtime/fixie/chat', { message: 'Hello' })
    const chatRes = await chat(chatReq as any, { params: Promise.resolve({ slug: 'fixie' }) })
    expect((await parseResponse(chatRes)).status).toBe(404)

    // Step 6: Resume
    const pausedDep = { ...dep, status: 'paused' }
    mocked.deployment.findFirst.mockResolvedValue(pausedDep)
    mocked.deployment.update.mockResolvedValue({ ...dep, status: 'active' })

    const resumeReq = createRequest('PATCH', `http://localhost/api/agents/${agent.id}/deploy`)
    const resumeRes = await resume(resumeReq as any, { params: Promise.resolve({ id: agent.id }) })
    const { status: resumeStatus, body: resumeBody } = await parseResponse<any>(resumeRes)

    expect(resumeStatus).toBe(200)
    expect(resumeBody.status).toBe('active')

    // Step 7: Runtime accessible again
    mocked.deployment.findFirst.mockResolvedValue(dep)

    const afterResumeReq = createRequest('GET', 'http://localhost/api/runtime/fixie')
    const afterResumeRes = await getInfo(afterResumeReq as any, { params: Promise.resolve({ slug: 'fixie' }) })
    expect((await parseResponse(afterResumeRes)).status).toBe(200)
  })

  it('pause when not deployed returns 404', async () => {
    const mocked = getMockedPrisma()
    mocked.deployment.findFirst.mockResolvedValue(null)

    const req = createRequest('DELETE', `http://localhost/api/agents/${agent.id}/deploy`)
    const res = await pause(req as any, { params: Promise.resolve({ id: agent.id }) })
    expect((await parseResponse(res)).status).toBe(404)
  })

  it('resume when not paused returns 404', async () => {
    const mocked = getMockedPrisma()
    mocked.deployment.findFirst.mockResolvedValue(null)

    const req = createRequest('PATCH', `http://localhost/api/agents/${agent.id}/deploy`)
    const res = await resume(req as any, { params: Promise.resolve({ id: agent.id }) })
    expect((await parseResponse(res)).status).toBe(404)
  })
})
