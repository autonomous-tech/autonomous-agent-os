import { describe, it, expect, beforeEach } from 'vitest'
import { POST, GET, DELETE, PATCH } from '@/app/api/agents/[id]/deploy/route'
import { getMockedPrisma, createTestAgent, cleanupDb, createRequest, parseResponse } from '../helpers/db'
import { sampleAgentConfig, sampleStageData } from '../helpers/fixtures'

describe('Deploy API', () => {
  beforeEach(() => {
    cleanupDb()
  })

  describe('POST /api/agents/[id]/deploy', () => {
    it('deploys an agent successfully', async () => {
      const agent = createTestAgent({
        config: JSON.stringify(sampleAgentConfig),
        stages: JSON.stringify(sampleStageData),
      })
      const mocked = getMockedPrisma()

      // No existing active deployments
      mocked.deployment.findMany.mockResolvedValue([])
      mocked.deployment.findFirst.mockResolvedValue(null)

      const mockDeployment = {
        id: 'dep_123',
        agentId: agent.id,
        version: 1,
        config: agent.config,
        systemPrompt: 'mock prompt',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mocked.deployment.create.mockResolvedValue(mockDeployment)
      mocked.agentProject.update.mockResolvedValue({ ...agent, status: 'deployed' })

      const request = createRequest('POST', `http://localhost/api/agents/${agent.id}/deploy`)
      const response = await POST(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { status, body } = await parseResponse(response)

      expect(status).toBe(200)
      expect(body).toHaveProperty('deployment')
      expect(body).toHaveProperty('publicUrl', `/a/${agent.slug}`)
      expect((body as any).deployment.version).toBe(1)
      expect((body as any).deployment.status).toBe('active')
    })

    it('rejects deployment for invalid config', async () => {
      const agent = createTestAgent({
        config: JSON.stringify({ mission: {} }),
        stages: JSON.stringify(sampleStageData),
      })

      const request = createRequest('POST', `http://localhost/api/agents/${agent.id}/deploy`)
      const response = await POST(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { status, body } = await parseResponse(response)

      expect(status).toBe(400)
      expect(body).toHaveProperty('error', 'Validation failed')
      expect((body as any).errors.length).toBeGreaterThan(0)
    })

    it('returns 404 for unknown agent', async () => {
      const request = createRequest('POST', 'http://localhost/api/agents/unknown/deploy')
      const response = await POST(request as any, { params: Promise.resolve({ id: 'unknown' }) })
      const { status } = await parseResponse(response)

      expect(status).toBe(404)
    })

    it('retires existing active deployments', async () => {
      const agent = createTestAgent({
        config: JSON.stringify(sampleAgentConfig),
        stages: JSON.stringify(sampleStageData),
      })
      const mocked = getMockedPrisma()

      const oldDeployment = {
        id: 'dep_old',
        agentId: agent.id,
        version: 1,
        status: 'active',
      }
      mocked.deployment.findMany.mockResolvedValue([oldDeployment])
      mocked.deployment.update.mockResolvedValue({ ...oldDeployment, status: 'retired' })
      mocked.deployment.findFirst.mockResolvedValue(oldDeployment)
      mocked.deployment.create.mockResolvedValue({
        id: 'dep_new',
        agentId: agent.id,
        version: 2,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      mocked.agentProject.update.mockResolvedValue({ ...agent, status: 'deployed' })

      const request = createRequest('POST', `http://localhost/api/agents/${agent.id}/deploy`)
      const response = await POST(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { status, body } = await parseResponse(response)

      expect(status).toBe(200)
      expect((body as any).deployment.version).toBe(2)

      // Verify old deployment was retired
      expect(mocked.deployment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dep_old' },
          data: { status: 'retired' },
        })
      )
    })
  })

  describe('GET /api/agents/[id]/deploy', () => {
    it('returns active deployment', async () => {
      const agent = createTestAgent()
      const mocked = getMockedPrisma()

      const mockDeployment = {
        id: 'dep_123',
        version: 1,
        status: 'active',
        createdAt: new Date(),
      }
      mocked.deployment.findFirst.mockResolvedValue(mockDeployment)

      const request = createRequest('GET', `http://localhost/api/agents/${agent.id}/deploy`)
      const response = await GET(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { status, body } = await parseResponse(response)

      expect(status).toBe(200)
      expect((body as any).deployment.id).toBe('dep_123')
      expect((body as any).publicUrl).toBe(`/a/${agent.slug}`)
    })

    it('returns null when no active deployment', async () => {
      const agent = createTestAgent()
      const mocked = getMockedPrisma()
      mocked.deployment.findFirst.mockResolvedValue(null)

      const request = createRequest('GET', `http://localhost/api/agents/${agent.id}/deploy`)
      const response = await GET(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { status, body } = await parseResponse(response)

      expect(status).toBe(200)
      expect((body as any).deployment).toBeNull()
    })
  })

  describe('DELETE /api/agents/[id]/deploy', () => {
    it('pauses an active deployment', async () => {
      const agent = createTestAgent()
      const mocked = getMockedPrisma()

      const mockDeployment = { id: 'dep_123', status: 'active' }
      mocked.deployment.findFirst.mockResolvedValue(mockDeployment)
      mocked.deployment.update.mockResolvedValue({ ...mockDeployment, status: 'paused' })

      const request = createRequest('DELETE', `http://localhost/api/agents/${agent.id}/deploy`)
      const response = await DELETE(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { status, body } = await parseResponse(response)

      expect(status).toBe(200)
      expect((body as any).status).toBe('paused')
    })

    it('returns 404 when no active deployment', async () => {
      const agent = createTestAgent()
      const mocked = getMockedPrisma()
      mocked.deployment.findFirst.mockResolvedValue(null)

      const request = createRequest('DELETE', `http://localhost/api/agents/${agent.id}/deploy`)
      const response = await DELETE(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { status } = await parseResponse(response)

      expect(status).toBe(404)
    })
  })

  describe('PATCH /api/agents/[id]/deploy', () => {
    it('resumes a paused deployment', async () => {
      const agent = createTestAgent()
      const mocked = getMockedPrisma()

      const mockDeployment = { id: 'dep_123', status: 'paused' }
      mocked.deployment.findFirst.mockResolvedValue(mockDeployment)
      mocked.deployment.update.mockResolvedValue({ ...mockDeployment, status: 'active' })

      const request = createRequest('PATCH', `http://localhost/api/agents/${agent.id}/deploy`)
      const response = await PATCH(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { status, body } = await parseResponse(response)

      expect(status).toBe(200)
      expect((body as any).status).toBe('active')
    })

    it('returns 404 when no paused deployment', async () => {
      const agent = createTestAgent()
      const mocked = getMockedPrisma()
      mocked.deployment.findFirst.mockResolvedValue(null)

      const request = createRequest('PATCH', `http://localhost/api/agents/${agent.id}/deploy`)
      const response = await PATCH(request as any, { params: Promise.resolve({ id: agent.id }) })
      const { status } = await parseResponse(response)

      expect(status).toBe(404)
    })
  })
})
