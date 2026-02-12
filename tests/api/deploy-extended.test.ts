import { describe, it, expect, beforeEach } from 'vitest'
import { POST, DELETE, PATCH } from '@/app/api/agents/[id]/deploy/route'
import { getMockedPrisma, createTestAgent, cleanupDb, createRequest, parseResponse } from '../helpers/db'
import { sampleAgentConfig, sampleStageData, createMockDeployment } from '../helpers/fixtures'

describe('Deploy API — Extended', () => {
  beforeEach(() => {
    cleanupDb()
  })

  describe('POST /api/agents/[id]/deploy — version management', () => {
    it('increments version correctly (v1→v2→v3)', async () => {
      const agent = createTestAgent({
        config: JSON.stringify(sampleAgentConfig),
        stages: JSON.stringify(sampleStageData),
      })
      const mocked = getMockedPrisma()

      // Simulate existing v2 deployment
      mocked.deployment.findMany.mockResolvedValue([])
      mocked.deployment.findFirst.mockResolvedValue({ version: 2 })
      mocked.deployment.create.mockResolvedValue({
        id: 'dep_v3',
        agentId: agent.id,
        version: 3,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      mocked.agentProject.update.mockResolvedValue({ ...agent, status: 'deployed' })

      const request = createRequest('POST', `http://localhost/api/agents/${agent.id}/deploy`)
      const response = await POST(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { status, body } = await parseResponse<any>(response)

      expect(status).toBe(200)
      expect(body.deployment.version).toBe(3)
    })

    it('captures system prompt snapshot on deploy', async () => {
      const agent = createTestAgent({
        config: JSON.stringify(sampleAgentConfig),
        stages: JSON.stringify(sampleStageData),
      })
      const mocked = getMockedPrisma()

      mocked.deployment.findMany.mockResolvedValue([])
      mocked.deployment.findFirst.mockResolvedValue(null)
      mocked.deployment.create.mockImplementation((args: any) => {
        return Promise.resolve({
          id: 'dep_new',
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      })
      mocked.agentProject.update.mockResolvedValue({ ...agent, status: 'deployed' })

      const request = createRequest('POST', `http://localhost/api/agents/${agent.id}/deploy`)
      await POST(request as any, { params: Promise.resolve({ id: agent.id }) })

      const createCall = mocked.deployment.create.mock.calls[0][0]
      expect(createCall.data.systemPrompt).toBeDefined()
      expect(createCall.data.systemPrompt.length).toBeGreaterThan(0)
      expect(createCall.data.systemPrompt).toContain('Fixie')
    })

    it('retires multiple active deployments', async () => {
      const agent = createTestAgent({
        config: JSON.stringify(sampleAgentConfig),
        stages: JSON.stringify(sampleStageData),
      })
      const mocked = getMockedPrisma()

      const activeDeps = [
        createMockDeployment({ id: 'dep_1', version: 1 }),
        createMockDeployment({ id: 'dep_2', version: 2 }),
      ]
      mocked.deployment.findMany.mockResolvedValue(activeDeps)
      mocked.deployment.update.mockResolvedValue({})
      mocked.deployment.findFirst.mockResolvedValue(activeDeps[1])
      mocked.deployment.create.mockResolvedValue({
        id: 'dep_3',
        agentId: agent.id,
        version: 3,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      mocked.agentProject.update.mockResolvedValue({ ...agent, status: 'deployed' })

      const request = createRequest('POST', `http://localhost/api/agents/${agent.id}/deploy`)
      await POST(request as any, { params: Promise.resolve({ id: agent.id }) })

      // Both old deployments should be retired
      expect(mocked.deployment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'dep_1' }, data: { status: 'retired' } })
      )
      expect(mocked.deployment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'dep_2' }, data: { status: 'retired' } })
      )
    })

    it('updates agent status to deployed', async () => {
      const agent = createTestAgent({
        config: JSON.stringify(sampleAgentConfig),
        stages: JSON.stringify(sampleStageData),
      })
      const mocked = getMockedPrisma()

      mocked.deployment.findMany.mockResolvedValue([])
      mocked.deployment.findFirst.mockResolvedValue(null)
      mocked.deployment.create.mockResolvedValue({
        id: 'dep_1',
        agentId: agent.id,
        version: 1,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      mocked.agentProject.update.mockResolvedValue({ ...agent, status: 'deployed' })

      const request = createRequest('POST', `http://localhost/api/agents/${agent.id}/deploy`)
      await POST(request as any, { params: Promise.resolve({ id: agent.id }) })

      expect(mocked.agentProject.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: agent.id },
          data: { status: 'deployed' },
        })
      )
    })

    it('returns 400 with errors array for invalid config', async () => {
      const agent = createTestAgent({
        config: JSON.stringify({ mission: {} }),
        stages: JSON.stringify(sampleStageData),
      })

      const request = createRequest('POST', `http://localhost/api/agents/${agent.id}/deploy`)
      const response = await POST(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { status, body } = await parseResponse<any>(response)

      expect(status).toBe(400)
      expect(body.error).toBe('Validation failed')
      expect(Array.isArray(body.errors)).toBe(true)
      expect(body.errors.length).toBeGreaterThan(0)
    })

    it('succeeds with warnings-only config (non-blocking)', async () => {
      // Config with required fields but missing optional ones
      const minimalConfig = {
        ...sampleAgentConfig,
        capabilities: { tools: [] },
        guardrails: undefined,
      }
      const agent = createTestAgent({
        config: JSON.stringify(minimalConfig),
        stages: JSON.stringify(sampleStageData),
      })
      const mocked = getMockedPrisma()

      mocked.deployment.findMany.mockResolvedValue([])
      mocked.deployment.findFirst.mockResolvedValue(null)
      mocked.deployment.create.mockResolvedValue({
        id: 'dep_1',
        agentId: agent.id,
        version: 1,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      mocked.agentProject.update.mockResolvedValue({ ...agent, status: 'deployed' })

      const request = createRequest('POST', `http://localhost/api/agents/${agent.id}/deploy`)
      const response = await POST(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { status } = await parseResponse(response)

      expect(status).toBe(200)
    })
  })

  describe('PATCH /api/agents/[id]/deploy — cannot resume active', () => {
    it('returns 404 when trying to resume an active deployment', async () => {
      const agent = createTestAgent()
      const mocked = getMockedPrisma()
      // PATCH looks for status: "paused" — an active deployment won't match
      mocked.deployment.findFirst.mockResolvedValue(null)

      const request = createRequest('PATCH', `http://localhost/api/agents/${agent.id}/deploy`)
      const response = await PATCH(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { status, body } = await parseResponse<any>(response)

      expect(status).toBe(404)
      expect(body.error).toBe('No paused deployment found')
    })
  })

  describe('DELETE /api/agents/[id]/deploy — cannot pause already-paused', () => {
    it('returns 404 when trying to pause an already-paused deployment', async () => {
      const agent = createTestAgent()
      const mocked = getMockedPrisma()
      // DELETE looks for status: "active" — a paused deployment won't match
      mocked.deployment.findFirst.mockResolvedValue(null)

      const request = createRequest('DELETE', `http://localhost/api/agents/${agent.id}/deploy`)
      const response = await DELETE(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { status, body } = await parseResponse<any>(response)

      expect(status).toBe(404)
      expect(body.error).toBe('No active deployment found')
    })
  })
})
