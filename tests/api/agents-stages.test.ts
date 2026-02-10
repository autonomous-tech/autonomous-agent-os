// =============================================================================
// Agent OS -- API Tests: /api/agents/[id]/stages/[stage] (PUT)
// =============================================================================
// Tests for direct editing of a single stage within an agent project.
// Source: src/app/api/agents/[id]/stages/[stage]/route.ts
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getMockedPrisma,
  cleanupDb,
  createRequest,
} from '../helpers/db'
import { createMockAgentProject } from '../helpers/fixtures'
import { STAGES } from '@/lib/types'

// ---------------------------------------------------------------------------
// Route handler imports
// ---------------------------------------------------------------------------

type StageRouteHandler = (
  req: Request,
  ctx: { params: Promise<{ id: string; stage: string }> }
) => Promise<Response>

let PUT: StageRouteHandler

beforeEach(async () => {
  cleanupDb()
  try {
    const mod = await import('@/app/api/agents/[id]/stages/[stage]/route')
    PUT = mod.PUT as unknown as StageRouteHandler
  } catch {
    PUT = async () =>
      new Response(JSON.stringify({ error: 'Not implemented' }), { status: 501 })
  }
})

function makeParams(id: string, stage: string) {
  return { params: Promise.resolve({ id, stage }) }
}

// ===========================================================================
// PUT /api/agents/[id]/stages/[stage]
// ===========================================================================

describe('PUT /api/agents/[id]/stages/[stage]', () => {
  it('updates stage data for a valid stage name and returns 200', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)
    mocked.agentProject.update.mockResolvedValue(agent)

    const res = await PUT(
      createRequest(
        'PUT',
        `http://localhost:3000/api/agents/${agent.id}/stages/mission`,
        {
          status: 'approved',
          data: {
            description: 'Updated mission description',
            tasks: ['Task A', 'Task B'],
          },
        }
      ),
      makeParams(agent.id, 'mission')
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('stage', 'mission')
    expect(mocked.agentProject.update).toHaveBeenCalled()
  })

  it('returns the updated stage status and data in the response', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)
    mocked.agentProject.update.mockResolvedValue(agent)

    const res = await PUT(
      createRequest(
        'PUT',
        `http://localhost:3000/api/agents/${agent.id}/stages/identity`,
        {
          status: 'draft',
          data: { name: 'Fixie 2.0', tone: 'professional' },
        }
      ),
      makeParams(agent.id, 'identity')
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('stage', 'identity')
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('config')
  })

  it('returns 404 for a non-existent agent', async () => {
    const mocked = getMockedPrisma()
    mocked.agentProject.findUnique.mockResolvedValue(null)

    const res = await PUT(
      createRequest(
        'PUT',
        'http://localhost:3000/api/agents/nonexistent/stages/mission',
        { status: 'draft', data: {} }
      ),
      makeParams('nonexistent', 'mission')
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(404)
    expect(body).toHaveProperty('error')
  })

  it('returns 400 for an invalid stage name', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    const res = await PUT(
      createRequest(
        'PUT',
        `http://localhost:3000/api/agents/${agent.id}/stages/invalid-stage`,
        { status: 'draft', data: {} }
      ),
      makeParams(agent.id, 'invalid-stage')
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(400)
    expect(body).toHaveProperty('error')
    // Error message should list valid stages
    expect((body.error as string).toLowerCase()).toContain('invalid stage')
  })

  it('accepts all 6 valid stage names', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)
    mocked.agentProject.update.mockResolvedValue(agent)

    for (const stage of STAGES) {
      const res = await PUT(
        createRequest(
          'PUT',
          `http://localhost:3000/api/agents/${agent.id}/stages/${stage}`,
          { status: 'draft', data: { updated: true } }
        ),
        makeParams(agent.id, stage)
      )

      expect(res.status).toBe(200)
    }
  })

  it('merges data into existing stage data (does not replace)', async () => {
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

    await PUT(
      createRequest(
        'PUT',
        `http://localhost:3000/api/agents/${agent.id}/stages/mission`,
        { data: { tasks: ['New Task 1', 'New Task 2'] } }
      ),
      makeParams(agent.id, 'mission')
    )

    expect(capturedUpdateData).toBeTruthy()
    const savedStages = JSON.parse(capturedUpdateData!.stages as string)
    // The mission stage data should include the new tasks
    expect(savedStages.mission.data.tasks).toEqual(['New Task 1', 'New Task 2'])
    // Other stages should still be present
    expect(savedStages).toHaveProperty('identity')
    expect(savedStages).toHaveProperty('capabilities')
  })

  it('updates config when configUpdate is provided', async () => {
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

    await PUT(
      createRequest(
        'PUT',
        `http://localhost:3000/api/agents/${agent.id}/stages/identity`,
        {
          status: 'approved',
          data: { name: 'Sage' },
          configUpdate: { name: 'Sage', tone: 'analytical' },
        }
      ),
      makeParams(agent.id, 'identity')
    )

    expect(capturedUpdateData).toBeTruthy()
    const savedConfig = JSON.parse(capturedUpdateData!.config as string)
    // The identity section of config should be updated
    expect(savedConfig.identity.name).toBe('Sage')
    expect(savedConfig.identity.tone).toBe('analytical')
  })

  it('handles stage status transitions (incomplete -> draft -> approved)', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)
    mocked.agentProject.update.mockResolvedValue(agent)

    const transitions = [
      { status: 'incomplete', data: {} },
      { status: 'draft', data: { description: 'Work in progress' } },
      { status: 'approved', data: { description: 'Final version' } },
    ]

    for (const transition of transitions) {
      const res = await PUT(
        createRequest(
          'PUT',
          `http://localhost:3000/api/agents/${agent.id}/stages/memory`,
          transition
        ),
        makeParams(agent.id, 'memory')
      )
      expect(res.status).toBe(200)
    }
  })
})
