// =============================================================================
// Agent OS -- API Tests: /api/agents/[id] (GET, PATCH, DELETE)
// =============================================================================
// Tests for retrieving, updating, and deleting individual agent projects.
// Source: src/app/api/agents/[id]/route.ts
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getMockedPrisma,
  cleanupDb,
  createRequest,
} from '../helpers/db'
import {
  createMockAgentProject,
  sampleAgentConfig,
  sampleStageData,
} from '../helpers/fixtures'

// ---------------------------------------------------------------------------
// Route handler imports -- Next.js 15 uses params as a Promise
// ---------------------------------------------------------------------------

type RouteHandler = (
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>

let GET: RouteHandler
let PATCH: RouteHandler
let DELETE: RouteHandler

beforeEach(async () => {
  cleanupDb()
  try {
    const mod = await import('@/app/api/agents/[id]/route')
    GET = mod.GET as unknown as RouteHandler
    PATCH = mod.PATCH as unknown as RouteHandler
    DELETE = mod.DELETE as unknown as RouteHandler
  } catch {
    const notImpl: RouteHandler = async () =>
      new Response(JSON.stringify({ error: 'Not implemented' }), { status: 501 })
    GET = notImpl
    PATCH = notImpl
    DELETE = notImpl
  }
})

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ===========================================================================
// GET /api/agents/[id]
// ===========================================================================

describe('GET /api/agents/[id]', () => {
  it('returns the full agent with parsed config and stages', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    const res = await GET(
      createRequest('GET', `http://localhost:3000/api/agents/${agent.id}`),
      makeParams(agent.id)
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body.id).toBe(agent.id)
    expect(body.name).toBe(agent.name)
    expect(body.slug).toBe(agent.slug)
    expect(body.description).toBe(agent.description)
    expect(body.status).toBe(agent.status)
  })

  it('returns config as a parsed object (not a JSON string)', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    const res = await GET(
      createRequest('GET', `http://localhost:3000/api/agents/${agent.id}`),
      makeParams(agent.id)
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(typeof body.config).toBe('object')
    const config = body.config as Record<string, unknown>
    expect(config).toHaveProperty('mission')
    expect(config).toHaveProperty('identity')
  })

  it('returns stages as a parsed object', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    const res = await GET(
      createRequest('GET', `http://localhost:3000/api/agents/${agent.id}`),
      makeParams(agent.id)
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(typeof body.stages).toBe('object')
    const stages = body.stages as Record<string, unknown>
    expect(stages).toHaveProperty('mission')
    expect(stages).toHaveProperty('guardrails')
  })

  it('returns conversations as a parsed object', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    const res = await GET(
      createRequest('GET', `http://localhost:3000/api/agents/${agent.id}`),
      makeParams(agent.id)
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(typeof body.conversations).toBe('object')
  })

  it('returns 404 for a non-existent ID', async () => {
    const mocked = getMockedPrisma()
    mocked.agentProject.findUnique.mockResolvedValue(null)

    const res = await GET(
      createRequest('GET', 'http://localhost:3000/api/agents/nonexistent-id'),
      makeParams('nonexistent-id')
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(404)
    expect(body).toHaveProperty('error')
  })

  it('calls prisma.agentProject.findUnique with the correct ID', async () => {
    const mocked = getMockedPrisma()
    mocked.agentProject.findUnique.mockResolvedValue(null)

    const testId = 'clx_test_123'
    await GET(
      createRequest('GET', `http://localhost:3000/api/agents/${testId}`),
      makeParams(testId)
    )

    expect(mocked.agentProject.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: testId } })
    )
  })
})

// ===========================================================================
// PATCH /api/agents/[id]
// ===========================================================================

describe('PATCH /api/agents/[id]', () => {
  it('updates agent name and returns the updated agent', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    const updatedAgent = { ...agent, name: 'Updated Fixie' }
    mocked.agentProject.update.mockResolvedValue(updatedAgent)

    const res = await PATCH(
      createRequest('PATCH', `http://localhost:3000/api/agents/${agent.id}`, {
        name: 'Updated Fixie',
      }),
      makeParams(agent.id)
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body.name).toBe('Updated Fixie')
  })

  it('merges config updates with existing config', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    let capturedUpdateData: Record<string, unknown> | null = null
    mocked.agentProject.update.mockImplementation(
      async (args: { data: Record<string, unknown> }) => {
        capturedUpdateData = args.data
        return { ...agent, ...args.data }
      }
    )

    await PATCH(
      createRequest('PATCH', `http://localhost:3000/api/agents/${agent.id}`, {
        config: { identity: { name: 'Fixie 2.0' } },
      }),
      makeParams(agent.id)
    )

    expect(capturedUpdateData).toBeTruthy()
    // The route merges existing config with the new config
    const savedConfig = JSON.parse(capturedUpdateData!.config as string)
    expect(savedConfig.identity.name).toBe('Fixie 2.0')
    // Existing mission data should still be present
    expect(savedConfig).toHaveProperty('mission')
  })

  it('returns 404 for a non-existent ID', async () => {
    const mocked = getMockedPrisma()
    mocked.agentProject.findUnique.mockResolvedValue(null)

    const res = await PATCH(
      createRequest('PATCH', 'http://localhost:3000/api/agents/nonexistent-id', {
        name: 'Ghost',
      }),
      makeParams('nonexistent-id')
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(404)
    expect(body).toHaveProperty('error')
  })

  it('can update the status field', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    const updatedAgent = { ...agent, status: 'exported' }
    mocked.agentProject.update.mockResolvedValue(updatedAgent)

    const res = await PATCH(
      createRequest('PATCH', `http://localhost:3000/api/agents/${agent.id}`, {
        status: 'exported',
      }),
      makeParams(agent.id)
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body.status).toBe('exported')
  })

  it('can update the stages JSON field', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    const newStages = {
      ...sampleStageData,
      mission: { status: 'approved', data: { description: 'Updated' } },
    }
    mocked.agentProject.update.mockResolvedValue({
      ...agent,
      stages: JSON.stringify(newStages),
    })

    const res = await PATCH(
      createRequest('PATCH', `http://localhost:3000/api/agents/${agent.id}`, {
        stages: newStages,
      }),
      makeParams(agent.id)
    )

    expect(res.status).toBe(200)
    expect(mocked.agentProject.update).toHaveBeenCalled()
  })

  it('can update the conversations JSON field', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    const newConversations = {
      mission: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi! Let us get started.' },
      ],
      identity: [],
      capabilities: [],
      memory: [],
      triggers: [],
      guardrails: [],
    }
    mocked.agentProject.update.mockResolvedValue({
      ...agent,
      conversations: JSON.stringify(newConversations),
    })

    const res = await PATCH(
      createRequest('PATCH', `http://localhost:3000/api/agents/${agent.id}`, {
        conversations: newConversations,
      }),
      makeParams(agent.id)
    )

    expect(res.status).toBe(200)
  })
})

// ===========================================================================
// DELETE /api/agents/[id]
// ===========================================================================

describe('DELETE /api/agents/[id]', () => {
  it('deletes an existing agent and returns success', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)
    mocked.agentProject.delete.mockResolvedValue(agent)

    const res = await DELETE(
      createRequest('DELETE', `http://localhost:3000/api/agents/${agent.id}`),
      makeParams(agent.id)
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('success', true)
  })

  it('returns 404 for a non-existent ID', async () => {
    const mocked = getMockedPrisma()
    mocked.agentProject.findUnique.mockResolvedValue(null)

    const res = await DELETE(
      createRequest('DELETE', 'http://localhost:3000/api/agents/nonexistent-id'),
      makeParams('nonexistent-id')
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(404)
    expect(body).toHaveProperty('error')
  })

  it('calls prisma.agentProject.delete with the correct ID', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)
    mocked.agentProject.delete.mockResolvedValue(agent)

    await DELETE(
      createRequest('DELETE', `http://localhost:3000/api/agents/${agent.id}`),
      makeParams(agent.id)
    )

    expect(mocked.agentProject.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: agent.id } })
    )
  })
})
