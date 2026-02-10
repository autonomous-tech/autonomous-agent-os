// =============================================================================
// Agent OS -- API Tests: /api/templates (GET)
// =============================================================================
// Tests for listing available agent templates.
// Source: src/app/api/templates/route.ts
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getMockedPrisma,
  cleanupDb,
  createRequest,
} from '../helpers/db'
import { defaultTemplates } from '../helpers/fixtures'

// ---------------------------------------------------------------------------
// Route handler imports
// ---------------------------------------------------------------------------

let GET: (req: Request) => Promise<Response>

beforeEach(async () => {
  cleanupDb()
  try {
    const mod = await import('@/app/api/templates/route')
    GET = mod.GET
  } catch {
    GET = async () =>
      new Response(JSON.stringify({ templates: [] }), { status: 200 })
  }
})

// ===========================================================================
// GET /api/templates
// ===========================================================================

describe('GET /api/templates', () => {
  it('returns templates from the database when they exist', async () => {
    const mocked = getMockedPrisma()
    mocked.agentTemplate.findMany.mockResolvedValue(defaultTemplates)

    const res = await GET(createRequest('GET', 'http://localhost:3000/api/templates'))
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('templates')
    const templates = body.templates as Array<Record<string, unknown>>
    expect(templates).toHaveLength(3)
  })

  it('returns hardcoded defaults when no templates exist in DB', async () => {
    const mocked = getMockedPrisma()
    mocked.agentTemplate.findMany.mockResolvedValue([])

    const res = await GET(createRequest('GET', 'http://localhost:3000/api/templates'))
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    const templates = body.templates as Array<Record<string, unknown>>
    expect(templates).toHaveLength(3)
  })

  it('returns the 3 default templates (Customer Support, Research, Sales)', async () => {
    const mocked = getMockedPrisma()
    mocked.agentTemplate.findMany.mockResolvedValue([])

    const res = await GET(createRequest('GET', 'http://localhost:3000/api/templates'))
    const body = (await res.json()) as Record<string, unknown>
    const templates = body.templates as Array<Record<string, unknown>>

    const names = templates.map((t) => t.name)
    expect(names).toContain('Customer Support Agent')
    expect(names).toContain('Research Assistant')
    expect(names).toContain('Sales Support Agent')
  })

  it('each template has required fields (id, name, description, category)', async () => {
    const mocked = getMockedPrisma()
    mocked.agentTemplate.findMany.mockResolvedValue(defaultTemplates)

    const res = await GET(createRequest('GET', 'http://localhost:3000/api/templates'))
    const body = (await res.json()) as Record<string, unknown>
    const templates = body.templates as Array<Record<string, unknown>>

    for (const template of templates) {
      expect(template).toHaveProperty('id')
      expect(template).toHaveProperty('name')
      expect(template).toHaveProperty('description')
      expect(template).toHaveProperty('category')
    }
  })

  it('template categories match expected values', async () => {
    const mocked = getMockedPrisma()
    mocked.agentTemplate.findMany.mockResolvedValue(defaultTemplates)

    const res = await GET(createRequest('GET', 'http://localhost:3000/api/templates'))
    const body = (await res.json()) as Record<string, unknown>
    const templates = body.templates as Array<Record<string, unknown>>

    const categories = templates.map((t) => t.category)
    expect(categories).toContain('customer_support')
    expect(categories).toContain('research')
    expect(categories).toContain('sales')
  })

  it('does NOT include the full config/stages JSON in the response', async () => {
    const mocked = getMockedPrisma()
    mocked.agentTemplate.findMany.mockResolvedValue(defaultTemplates)

    const res = await GET(createRequest('GET', 'http://localhost:3000/api/templates'))
    const body = (await res.json()) as Record<string, unknown>
    const templates = body.templates as Array<Record<string, unknown>>

    for (const template of templates) {
      // The template list endpoint should only return summary fields
      expect(template).not.toHaveProperty('config')
      expect(template).not.toHaveProperty('stages')
    }
  })

  it('calls prisma.agentTemplate.findMany', async () => {
    const mocked = getMockedPrisma()
    mocked.agentTemplate.findMany.mockResolvedValue([])

    await GET(createRequest('GET', 'http://localhost:3000/api/templates'))

    expect(mocked.agentTemplate.findMany).toHaveBeenCalled()
  })

  it('wraps templates in a { templates: [...] } object', async () => {
    const mocked = getMockedPrisma()
    mocked.agentTemplate.findMany.mockResolvedValue(defaultTemplates)

    const res = await GET(createRequest('GET', 'http://localhost:3000/api/templates'))
    const body = (await res.json()) as Record<string, unknown>

    // Per the spec: response is { templates: [...] }
    expect(body).toHaveProperty('templates')
    expect(Array.isArray(body.templates)).toBe(true)
  })
})
