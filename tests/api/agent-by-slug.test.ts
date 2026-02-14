import { describe, it, expect, beforeEach } from 'vitest'
import { GET } from '@/app/api/agents/by-slug/[slug]/route'
import { createTestAgent, cleanupDb, createRequest, parseResponse } from '../helpers/db'

describe('GET /api/agents/by-slug/[slug]', () => {
  beforeEach(() => {
    cleanupDb()
  })

  it('returns agent when found by slug', async () => {
    const agent = createTestAgent({ slug: 'fixie', lettaAgentId: 'letta-123' })
    const request = createRequest('GET', 'http://test/api/agents/by-slug/fixie')

    const response = await GET(request, {
      params: Promise.resolve({ slug: 'fixie' }),
    })

    const { status, body } = await parseResponse<{
      id: string
      name: string
      slug: string
      description: string
      status: string
      config: Record<string, unknown>
      lettaAgentId: string
    }>(response)

    expect(status).toBe(200)
    expect(body.id).toBe(agent.id)
    expect(body.slug).toBe('fixie')
    expect(body.name).toBe('Fixie')
    expect(body.lettaAgentId).toBe('letta-123')
    expect(body.config).toBeDefined()
    expect(body.config.mission).toBeDefined()
  })

  it('returns 404 when agent not found', async () => {
    const request = createRequest('GET', 'http://test/api/agents/by-slug/nonexistent')

    const response = await GET(request, {
      params: Promise.resolve({ slug: 'nonexistent' }),
    })

    const { status, body } = await parseResponse<{ error: string }>(response)
    expect(status).toBe(404)
    expect(body.error).toBe('Agent not found')
  })

  it('returns parsed config as JSON object', async () => {
    createTestAgent({
      slug: 'test-agent',
      config: JSON.stringify({
        mission: { description: 'Test mission' },
        identity: { name: 'Tester' },
      }),
    })

    const request = createRequest('GET', 'http://test/api/agents/by-slug/test-agent')

    const response = await GET(request, {
      params: Promise.resolve({ slug: 'test-agent' }),
    })

    const { status, body } = await parseResponse<{
      config: { mission: { description: string }; identity: { name: string } }
    }>(response)

    expect(status).toBe(200)
    expect(body.config.mission.description).toBe('Test mission')
    expect(body.config.identity.name).toBe('Tester')
  })
})
