// =============================================================================
// Agent OS -- API Tests: /api/export (POST)
// =============================================================================
// Tests for validating and exporting agent configurations as ZIP files.
// Source: src/app/api/export/route.ts
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
  incompleteAgentConfig,
} from '../helpers/fixtures'
import type { StageData } from '@/lib/types'

// ---------------------------------------------------------------------------
// Mock the @/lib/export module to avoid actual ZIP generation in unit tests
// We test the ZIP generation separately in tests/lib/export.test.ts
// ---------------------------------------------------------------------------

vi.mock('@/lib/export', () => {
  return {
    validateAgent: vi.fn().mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    }),
    generateZip: vi.fn().mockResolvedValue(
      // Minimal valid ZIP (PK\x03\x04 header + end of central directory)
      Buffer.from([
        0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x50, 0x4b, 0x05, 0x06,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ])
    ),
  }
})

// ---------------------------------------------------------------------------
// Route handler imports
// ---------------------------------------------------------------------------

let POST: (req: Request) => Promise<Response>
let validateAgent: ReturnType<typeof vi.fn>
let generateZip: ReturnType<typeof vi.fn>

beforeEach(async () => {
  cleanupDb()

  // Re-import the mocked export module
  const exportMod = await import('@/lib/export')
  validateAgent = vi.mocked(exportMod.validateAgent)
  generateZip = vi.mocked(exportMod.generateZip)

  // Reset to defaults
  validateAgent.mockReturnValue({ valid: true, errors: [], warnings: [] })
  generateZip.mockResolvedValue(
    Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00])
  )

  try {
    const mod = await import('@/app/api/export/route')
    POST = mod.POST as unknown as (req: Request) => Promise<Response>
  } catch {
    POST = async () =>
      new Response(JSON.stringify({ error: 'Not implemented' }), { status: 501 })
  }
})

// ===========================================================================
// POST /api/export
// ===========================================================================

describe('POST /api/export', () => {
  it('generates a ZIP for a valid agent and returns application/zip', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject({
      config: JSON.stringify(sampleAgentConfig),
      stages: JSON.stringify(sampleStageData),
    })
    mocked.agentProject.findUnique.mockResolvedValue(agent)
    mocked.agentProject.update.mockResolvedValue({
      ...agent,
      status: 'exported',
    })

    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/export', {
        projectId: agent.id,
      })
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/zip')
    expect(res.headers.get('content-disposition')).toContain('attachment')
    expect(res.headers.get('content-disposition')).toContain(agent.slug)
  })

  it('returns 400 with validation errors for an incomplete agent', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject({
      name: '',
      config: JSON.stringify(incompleteAgentConfig),
      stages: JSON.stringify({
        mission: { status: 'incomplete', data: {} },
        identity: { status: 'incomplete', data: {} },
        capabilities: { status: 'incomplete', data: {} },
        memory: { status: 'incomplete', data: {} },
        triggers: { status: 'incomplete', data: {} },
        guardrails: { status: 'incomplete', data: {} },
      }),
    })
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    // Make validateAgent return errors
    validateAgent.mockReturnValue({
      valid: false,
      errors: [
        {
          level: 'structural',
          message: 'Agent name is missing',
          fix: 'Set a name in the Identity stage',
        },
        {
          level: 'structural',
          message: 'No capabilities defined',
          fix: 'Add at least one capability',
        },
      ],
      warnings: [
        {
          level: 'completeness',
          message: 'No exclusions defined',
        },
      ],
    })

    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/export', {
        projectId: agent.id,
      })
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(400)
    expect(body).toHaveProperty('valid', false)
    expect(body).toHaveProperty('errors')
    const errors = body.errors as Array<Record<string, unknown>>
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toHaveProperty('level', 'structural')
    expect(errors[0]).toHaveProperty('message')
  })

  it('includes warnings in the 400 response', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    validateAgent.mockReturnValue({
      valid: false,
      errors: [
        { level: 'structural', message: 'Name missing', fix: 'Add a name' },
      ],
      warnings: [
        { level: 'completeness', message: 'No exclusions defined' },
      ],
    })

    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/export', {
        projectId: agent.id,
      })
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(body).toHaveProperty('warnings')
    const warnings = body.warnings as Array<Record<string, unknown>>
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('returns 404 for a non-existent project', async () => {
    const mocked = getMockedPrisma()
    mocked.agentProject.findUnique.mockResolvedValue(null)

    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/export', {
        projectId: 'nonexistent-id',
      })
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(404)
    expect(body).toHaveProperty('error')
  })

  it('returns 400 when projectId is missing', async () => {
    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/export', {})
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(400)
    expect(body).toHaveProperty('error')
  })

  it('calls validateAgent with parsed config and stages', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject({
      config: JSON.stringify(sampleAgentConfig),
      stages: JSON.stringify(sampleStageData),
    })
    mocked.agentProject.findUnique.mockResolvedValue(agent)
    mocked.agentProject.update.mockResolvedValue(agent)

    await POST(
      createRequest('POST', 'http://localhost:3000/api/export', {
        projectId: agent.id,
      })
    )

    expect(validateAgent).toHaveBeenCalledWith(
      sampleAgentConfig,
      sampleStageData
    )
  })

  it('calls generateZip with the full agent project', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject({
      config: JSON.stringify(sampleAgentConfig),
      stages: JSON.stringify(sampleStageData),
    })
    mocked.agentProject.findUnique.mockResolvedValue(agent)
    mocked.agentProject.update.mockResolvedValue(agent)

    await POST(
      createRequest('POST', 'http://localhost:3000/api/export', {
        projectId: agent.id,
      })
    )

    expect(generateZip).toHaveBeenCalledWith(agent)
  })

  it('updates agent status to "exported" and sets exportedAt', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject({
      config: JSON.stringify(sampleAgentConfig),
      stages: JSON.stringify(sampleStageData),
    })
    mocked.agentProject.findUnique.mockResolvedValue(agent)
    mocked.agentProject.update.mockResolvedValue({
      ...agent,
      status: 'exported',
    })

    await POST(
      createRequest('POST', 'http://localhost:3000/api/export', {
        projectId: agent.id,
      })
    )

    expect(mocked.agentProject.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: agent.id },
        data: expect.objectContaining({
          status: 'exported',
          exportedAt: expect.any(Date),
        }),
      })
    )
  })

  it('sets Content-Disposition header with agent slug as filename', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject({
      slug: 'fixie',
      config: JSON.stringify(sampleAgentConfig),
      stages: JSON.stringify(sampleStageData),
    })
    mocked.agentProject.findUnique.mockResolvedValue(agent)
    mocked.agentProject.update.mockResolvedValue(agent)

    const res = await POST(
      createRequest('POST', 'http://localhost:3000/api/export', {
        projectId: agent.id,
      })
    )

    const disposition = res.headers.get('content-disposition')
    expect(disposition).toContain('fixie.zip')
  })

  it('does not call generateZip when validation fails', async () => {
    const mocked = getMockedPrisma()
    const agent = createMockAgentProject()
    mocked.agentProject.findUnique.mockResolvedValue(agent)

    validateAgent.mockReturnValue({
      valid: false,
      errors: [{ level: 'structural', message: 'Name missing' }],
      warnings: [],
    })

    // Clear the generateZip call count from previous tests
    generateZip.mockClear()

    await POST(
      createRequest('POST', 'http://localhost:3000/api/export', {
        projectId: agent.id,
      })
    )

    expect(generateZip).not.toHaveBeenCalled()
  })
})
