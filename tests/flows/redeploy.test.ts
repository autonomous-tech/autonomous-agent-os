import { describe, it, expect, beforeEach } from 'vitest'
import { POST as deploy } from '@/app/api/agents/[id]/deploy/route'
import { GET as getInfo } from '@/app/api/runtime/[slug]/route'
import { getMockedPrisma, cleanupDb, createRequest, parseResponse } from '../helpers/db'
import {
  createMockAgentProject,
  createMockDeployment,
  sampleAgentConfig,
  sampleStageData,
  helixAgentConfig,
} from '../helpers/fixtures'

describe('Flow: Redeploy', () => {
  const agent = createMockAgentProject({
    slug: 'fixie',
    config: JSON.stringify(sampleAgentConfig),
    stages: JSON.stringify(sampleStageData),
  })

  beforeEach(() => {
    cleanupDb()
    const mocked = getMockedPrisma()
    mocked.agentProject.findUnique.mockImplementation((args: any) => {
      if (args.where.id === agent.id || args.where.slug === agent.slug) {
        return Promise.resolve(agent)
      }
      return Promise.resolve(null)
    })
  })

  it('deploy v1, then redeploy creates v2 and retires v1', async () => {
    const mocked = getMockedPrisma()

    // Deploy v1
    mocked.deployment.findMany.mockResolvedValue([])
    mocked.deployment.findFirst.mockResolvedValue(null)
    const v1 = createMockDeployment({ id: 'dep_v1', version: 1 })
    mocked.deployment.create.mockResolvedValue(v1)
    mocked.agentProject.update.mockResolvedValue({ ...agent, status: 'deployed' })

    const req1 = createRequest('POST', `http://localhost/api/agents/${agent.id}/deploy`)
    const res1 = await deploy(req1 as any, { params: Promise.resolve({ id: agent.id }) })
    const { body: body1 } = await parseResponse<any>(res1)
    expect(body1.deployment.version).toBe(1)

    // Redeploy — v1 is now active
    mocked.deployment.findMany.mockResolvedValue([v1])
    mocked.deployment.findFirst.mockResolvedValue(v1)
    mocked.deployment.update.mockResolvedValue({ ...v1, status: 'retired' })
    const v2 = createMockDeployment({ id: 'dep_v2', version: 2 })
    mocked.deployment.create.mockResolvedValue(v2)

    const req2 = createRequest('POST', `http://localhost/api/agents/${agent.id}/deploy`)
    const res2 = await deploy(req2 as any, { params: Promise.resolve({ id: agent.id }) })
    const { status, body: body2 } = await parseResponse<any>(res2)

    expect(status).toBe(200)
    expect(body2.deployment.version).toBe(2)

    // Verify v1 was retired
    expect(mocked.deployment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'dep_v1' }, data: { status: 'retired' } })
    )
  })

  it('public endpoint serves updated config after redeploy', async () => {
    const mocked = getMockedPrisma()

    // Update the agent config with a new identity name
    const updatedConfig = {
      ...sampleAgentConfig,
      identity: { ...sampleAgentConfig.identity, name: 'Fixie Pro' },
    }
    const v2 = createMockDeployment({
      id: 'dep_v2',
      version: 2,
      config: JSON.stringify(updatedConfig),
    })
    mocked.deployment.findFirst.mockResolvedValue(v2)

    const req = createRequest('GET', 'http://localhost/api/runtime/fixie')
    const res = await getInfo(req as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { body } = await parseResponse<any>(res)

    expect(body.agent.name).toBe('Fixie Pro')
  })

  it('deployment.create called with updated config snapshot', async () => {
    const mocked = getMockedPrisma()

    mocked.deployment.findMany.mockResolvedValue([])
    mocked.deployment.findFirst.mockResolvedValue(null)
    mocked.deployment.create.mockImplementation((args: any) =>
      Promise.resolve({
        id: 'dep_new',
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    )
    mocked.agentProject.update.mockResolvedValue({ ...agent, status: 'deployed' })

    const req = createRequest('POST', `http://localhost/api/agents/${agent.id}/deploy`)
    await deploy(req as any, { params: Promise.resolve({ id: agent.id }) })

    const createCall = mocked.deployment.create.mock.calls[0][0]
    expect(createCall.data.config).toBe(agent.config) // snapshot from agent
    expect(createCall.data.agentId).toBe(agent.id)
  })

  it('version numbering is based on highest existing version', async () => {
    const mocked = getMockedPrisma()

    // Simulate: v1 retired, v2 retired, now deploying v3
    mocked.deployment.findMany.mockResolvedValue([])
    mocked.deployment.findFirst.mockResolvedValue({ version: 5 }) // highest existing
    mocked.deployment.create.mockResolvedValue(
      createMockDeployment({ id: 'dep_v6', version: 6 })
    )
    mocked.agentProject.update.mockResolvedValue({ ...agent, status: 'deployed' })

    const req = createRequest('POST', `http://localhost/api/agents/${agent.id}/deploy`)
    const res = await deploy(req as any, { params: Promise.resolve({ id: agent.id }) })
    const { body } = await parseResponse<any>(res)

    expect(body.deployment.version).toBe(6)
  })
})
