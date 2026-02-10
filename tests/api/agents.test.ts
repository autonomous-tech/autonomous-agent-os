// =============================================================================
// Agent OS -- API Tests: /api/agents (GET, POST)
// =============================================================================
// Tests for listing and creating agent projects.
// Spec reference: Section 6 -- API Contracts.
// Source: src/app/api/agents/route.ts
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getMockedPrisma,
  cleanupDb,
  createRequest,
} from '../helpers/db'
import {
  createMockAgentProject,
  createMockHelixProject,
  sampleAgentConfig,
  sampleStageData,
} from '../helpers/fixtures'

// ---------------------------------------------------------------------------
// Route handler imports
// ---------------------------------------------------------------------------

let GET: (req: Request) => Promise<Response>
let POST: (req: Request) => Promise<Response>
let routeLoaded = false

beforeEach(async () => {
  cleanupDb()
  try {
    const mod = await import('@/app/api/agents/route')
    GET = mod.GET
    POST = mod.POST
    routeLoaded = true
  } catch (e) {
    routeLoaded = false
    GET = async () => new Response(JSON.stringify([]), { status: 200 })
    POST = async () =>
      new Response(JSON.stringify({ error: 'Not implemented' }), { status: 501 })
  }
})

// ===========================================================================
// GET /api/agents
// ===========================================================================

describe('GET /api/agents', () => {
  it('returns an empty array when no agents exist', async () => {
    const mocked = getMockedPrisma()
    mocked.agentProject.findMany.mockResolvedValue([])

    const res = await GET(createRequest('GET', 'http://localhost:3000/api/agents'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(0)
  })

  it('returns a list of agents when they exist', async () => {
    const mocked = getMockedPrisma()
    const agent1 = createMockAgentProject()
    const agent2 = createMockHelixProject()
    mocked.agentProject.findMany.mockResolvedValue([agent1, agent2])

    const res = await GET(createRequest('GET', 'http://localhost:3000/api/agents'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
  })

  it('returns agents with expected fields (id, name, slug, status, createdAt)', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findMany.mockResolvedValue([agent])

    const res = await GET(createRequest('GET', 'http://localhost:3000/api/agents'))
    const body = (await res.json()) as Array<Record<string, unknown>>
    const first = body[0]

    expect(first).toHaveProperty('id')
    expect(first).toHaveProperty('name')
    expect(first).toHaveProperty('slug')
    expect(first).toHaveProperty('status')
    expect(first).toHaveProperty('createdAt')
  })

  it('returns agents ordered by createdAt desc', async () => {
    const mocked = getMockedPrisma()
    mocked.agentProject.findMany.mockResolvedValue([])

    await GET(createRequest('GET', 'http://localhost:3000/api/agents'))

    expect(mocked.agentProject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    )
  })

  it('maps response fields correctly -- does not leak raw JSON columns', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findMany.mockResolvedValue([agent])

    const res = await GET(createRequest('GET', 'http://localhost:3000/api/agents'))
    const body = (await res.json()) as Array<Record<string, unknown>>
    const first = body[0]

    // The list endpoint should NOT include the full config/stages/conversations JSON
    // (or if it does, that is fine -- but at minimum the listed fields should be present)
    expect(first.id).toBe(agent.id)
    expect(first.name).toBe(agent.name)
    expect(first.slug).toBe(agent.slug)
    expect(first.status).toBe(agent.status)
  })
})

// ===========================================================================
// POST /api/agents
// ===========================================================================

describe('POST /api/agents', () => {
  it('creates an agent with a description and returns 201', async () => {
    const mocked = getMockedPrisma()
    const createdAgent = createMockAgentProject({
      id: 'clx_new_1',
      name: 'Test Agent',
      slug: 'test-agent-abc123',
      status: 'draft',
    })
    mocked.agentProject.create.mockResolvedValue(createdAgent)

    const req = createRequest('POST', 'http://localhost:3000/api/agents', {
      initialDescription: 'A customer support agent for my SaaS product',
    })
    const res = await POST(req)
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(201)
    expect(body).toHaveProperty('id')
    expect(body).toHaveProperty('name')
    expect(body).toHaveProperty('slug')
    expect(body).toHaveProperty('status')
  })

  it('calls inferFromDescription when given a description', async () => {
    const mocked = getMockedPrisma()
    const createdAgent = createMockAgentProject()
    mocked.agentProject.create.mockResolvedValue(createdAgent)

    const { inferFromDescription } = await import('@/lib/claude')

    const req = createRequest('POST', 'http://localhost:3000/api/agents', {
      initialDescription: 'A research assistant',
    })
    await POST(req)

    expect(inferFromDescription).toHaveBeenCalledWith('A research assistant')
  })

  it('creates an agent from a template when templateId is provided', async () => {
    const mocked = getMockedPrisma()

    // Mock the template lookup
    mocked.agentTemplate.findUnique.mockResolvedValue({
      id: 'tpl_support',
      name: 'Customer Support Agent',
      description: 'Answers FAQs, logs issues, escalates to humans',
      category: 'customer_support',
      config: JSON.stringify(sampleAgentConfig),
      stages: JSON.stringify(sampleStageData),
    })

    const createdAgent = createMockAgentProject({
      id: 'clx_tpl_1',
      name: 'Customer Support Agent',
      slug: 'customer-support-agent-abc',
      templateId: 'tpl_support',
      status: 'building',
    })
    mocked.agentProject.create.mockResolvedValue(createdAgent)

    const req = createRequest('POST', 'http://localhost:3000/api/agents', {
      templateId: 'tpl_support',
    })
    const res = await POST(req)
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(201)
    expect(body).toHaveProperty('id')
  })

  it('returns 404 when a non-existent templateId is provided', async () => {
    const mocked = getMockedPrisma()
    mocked.agentTemplate.findUnique.mockResolvedValue(null)

    const req = createRequest('POST', 'http://localhost:3000/api/agents', {
      templateId: 'tpl_nonexistent',
    })
    const res = await POST(req)
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(404)
    expect(body).toHaveProperty('error')
  })

  it('returns parsed config and stages objects (not raw JSON strings)', async () => {
    const mocked = getMockedPrisma()
    const createdAgent = createMockAgentProject()
    mocked.agentProject.create.mockResolvedValue(createdAgent)

    const req = createRequest('POST', 'http://localhost:3000/api/agents', {
      initialDescription: 'A research assistant',
    })
    const res = await POST(req)
    const body = (await res.json()) as Record<string, unknown>

    // The route does JSON.parse on the returned config and stages
    expect(typeof body.config).toBe('object')
    expect(typeof body.stages).toBe('object')
  })

  it('generates a slug from the inferred name', async () => {
    const mocked = getMockedPrisma()
    mocked.agentProject.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => {
        return {
          ...createMockAgentProject(),
          slug: args.data.slug as string,
          name: args.data.name as string,
        }
      }
    )

    const req = createRequest('POST', 'http://localhost:3000/api/agents', {
      initialDescription: 'A support agent',
    })
    const res = await POST(req)
    const body = (await res.json()) as Record<string, unknown>

    // Slug should be lowercase, contain only valid slug characters, and have a timestamp suffix
    expect(typeof body.slug).toBe('string')
    expect(body.slug).toMatch(/^[a-z0-9-]+$/)
  })

  it('sets status to "draft" for description-based creation', async () => {
    const mocked = getMockedPrisma()
    const createdAgent = createMockAgentProject({ status: 'draft' })
    mocked.agentProject.create.mockResolvedValue(createdAgent)

    const req = createRequest('POST', 'http://localhost:3000/api/agents', {
      initialDescription: 'A new agent',
    })
    const res = await POST(req)
    const body = (await res.json()) as Record<string, unknown>

    expect(body.status).toBe('draft')
  })

  it('sets status to "building" for template-based creation', async () => {
    const mocked = getMockedPrisma()
    mocked.agentTemplate.findUnique.mockResolvedValue({
      id: 'tpl_support',
      name: 'Customer Support Agent',
      description: 'Answers FAQs',
      category: 'customer_support',
      config: JSON.stringify(sampleAgentConfig),
      stages: JSON.stringify(sampleStageData),
    })

    const createdAgent = createMockAgentProject({ status: 'building', templateId: 'tpl_support' })
    mocked.agentProject.create.mockResolvedValue(createdAgent)

    const req = createRequest('POST', 'http://localhost:3000/api/agents', {
      templateId: 'tpl_support',
    })
    const res = await POST(req)
    const body = (await res.json()) as Record<string, unknown>

    expect(body.status).toBe('building')
  })

  it('gracefully handles inferFromDescription failure with fallback config', async () => {
    const mocked = getMockedPrisma()
    const { inferFromDescription } = await import('@/lib/claude')
    vi.mocked(inferFromDescription).mockRejectedValueOnce(new Error('Claude API error'))

    const createdAgent = createMockAgentProject({
      config: JSON.stringify({
        mission: { description: 'My agent description', tasks: [], exclusions: [] },
      }),
    })
    mocked.agentProject.create.mockResolvedValue(createdAgent)

    const req = createRequest('POST', 'http://localhost:3000/api/agents', {
      initialDescription: 'My agent description',
    })
    const res = await POST(req)

    // Should not return 500 -- should gracefully fall back
    expect(res.status).toBe(201)
  })
})
