import { describe, it, expect, beforeEach } from 'vitest'
import { GET } from '@/app/api/runtime/[slug]/route'
import { getMockedPrisma, cleanupDb, createRequest, parseResponse } from '../helpers/db'
import { createMockAgentProject, createMockDeployment, sampleAgentConfig } from '../helpers/fixtures'

describe('Runtime Info API — GET /api/runtime/[slug]', () => {
  const agent = createMockAgentProject({ slug: 'fixie' })
  const deployment = createMockDeployment({ agentId: agent.id })

  beforeEach(() => {
    cleanupDb()
    const mocked = getMockedPrisma()
    mocked.agentProject.findUnique.mockResolvedValue(agent)
    mocked.deployment.findFirst.mockResolvedValue(deployment)
  })

  it('returns agent info for active deployment', async () => {
    const request = createRequest('GET', 'http://localhost/api/runtime/fixie')
    const response = await GET(request as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { status, body } = await parseResponse<any>(response)

    expect(status).toBe(200)
    expect(body.agent.name).toBe('Fixie')
    expect(body.agent.emoji).toBe('wrench')
    expect(body.agent.greeting).toContain('Fixie')
    expect(body.agent.description).toContain('Customer support')
    expect(body.agent.vibe).toBe('Friendly, helpful, solution-oriented')
    expect(body.agent.tone).toBe('casual-professional')
    expect(body.maxTurns).toBe(50)
  })

  it('returns 404 for unknown slug', async () => {
    const mocked = getMockedPrisma()
    mocked.agentProject.findUnique.mockResolvedValue(null)

    const request = createRequest('GET', 'http://localhost/api/runtime/unknown')
    const response = await GET(request as any, { params: Promise.resolve({ slug: 'unknown' }) })
    const { status, body } = await parseResponse<any>(response)

    expect(status).toBe(404)
    expect(body.error).toBe('Agent not found')
  })

  it('returns 404 when no active deployment', async () => {
    const mocked = getMockedPrisma()
    mocked.deployment.findFirst.mockResolvedValue(null)

    const request = createRequest('GET', 'http://localhost/api/runtime/fixie')
    const response = await GET(request as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { status, body } = await parseResponse<any>(response)

    expect(status).toBe(404)
    expect(body.error).toBe('Agent is not currently deployed')
  })

  it('does not expose sensitive fields', async () => {
    const request = createRequest('GET', 'http://localhost/api/runtime/fixie')
    const response = await GET(request as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { body } = await parseResponse<any>(response)

    // Should NOT have tools, guardrails, memory, triggers, capabilities
    expect(body.agent).not.toHaveProperty('tools')
    expect(body.agent).not.toHaveProperty('guardrails')
    expect(body.agent).not.toHaveProperty('memory')
    expect(body.agent).not.toHaveProperty('triggers')
    expect(body.agent).not.toHaveProperty('capabilities')
    expect(body).not.toHaveProperty('systemPrompt')
  })

  it('returns custom maxTurns from config', async () => {
    const mocked = getMockedPrisma()
    const customConfig = {
      ...sampleAgentConfig,
      guardrails: {
        ...sampleAgentConfig.guardrails,
        resource_limits: { max_turns_per_session: 25 },
      },
    }
    const customDeployment = createMockDeployment({
      config: JSON.stringify(customConfig),
    })
    mocked.deployment.findFirst.mockResolvedValue(customDeployment)

    const request = createRequest('GET', 'http://localhost/api/runtime/fixie')
    const response = await GET(request as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { body } = await parseResponse<any>(response)

    expect(body.maxTurns).toBe(25)
  })

  it('returns defaults when config fields are missing', async () => {
    const mocked = getMockedPrisma()
    const emptyConfig = {}
    const emptyDeployment = createMockDeployment({
      config: JSON.stringify(emptyConfig),
    })
    mocked.deployment.findFirst.mockResolvedValue(emptyDeployment)

    const request = createRequest('GET', 'http://localhost/api/runtime/fixie')
    const response = await GET(request as any, { params: Promise.resolve({ slug: 'fixie' }) })
    const { status, body } = await parseResponse<any>(response)

    expect(status).toBe(200)
    // Falls back to agent.name when config.identity.name is missing
    expect(body.agent.name).toBe('Fixie')
    expect(body.agent.greeting).toContain('Fixie')
    expect(body.maxTurns).toBe(50) // default
  })
})
