import { describe, it, expect, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { POST } from '@/app/api/agents/[id]/enrich/route'
import { chat } from '@/lib/claude'
import { createTestAgent, cleanupDb, createRequest, parseResponse } from '../helpers/db'
import { sampleAgentConfig } from '../helpers/fixtures'
import type { EnrichmentResponse } from '@/lib/types'

const mockChat = chat as unknown as Mock

describe('POST /api/agents/[id]/enrich', () => {
  beforeEach(() => {
    cleanupDb()
    mockChat.mockClear()
  })

  it('returns enrichment response for valid section data', async () => {
    const agent = createTestAgent()

    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        suggestions: [
          {
            field: 'description',
            original: 'Customer support agent',
            improved: 'Customer support agent specializing in SaaS troubleshooting',
            reason: 'More specific description improves clarity',
          },
        ],
        ideas: [
          {
            type: 'task',
            value: 'Handle password reset requests',
            reason: 'Common support task missing from the list',
          },
        ],
        questions: [
          {
            question: 'Do you need multi-language support?',
            options: ['English only', 'Multi-language', 'Auto-detect'],
            affects: ['capabilities'],
            reason: 'Language support significantly affects agent design',
          },
        ],
      })
    )

    const request = createRequest({
      section: 'purpose',
      sectionData: {
        description: sampleAgentConfig.mission!.description,
        tasks: sampleAgentConfig.mission!.tasks,
      },
      fullConfig: sampleAgentConfig,
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: agent.id }),
    })

    const { status, body } = await parseResponse<EnrichmentResponse>(response)

    expect(status).toBe(200)
    expect(body.suggestions).toHaveLength(1)
    expect(body.suggestions[0].field).toBe('description')
    expect(body.suggestions[0].improved).toContain('SaaS troubleshooting')
    expect(body.ideas).toHaveLength(1)
    expect(body.ideas[0].type).toBe('task')
    expect(body.questions).toHaveLength(1)
    expect(body.questions[0].question).toContain('multi-language')
  })

  it('returns 400 when section is missing', async () => {
    const agent = createTestAgent()

    const request = createRequest({
      sectionData: { description: 'test' },
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: agent.id }),
    })

    const { status, body } = await parseResponse<{ error: string }>(response)

    expect(status).toBe(400)
    expect(body.error).toBe('Missing section or sectionData')
  })

  it('returns 400 when sectionData is missing', async () => {
    const agent = createTestAgent()

    const request = createRequest({
      section: 'purpose',
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: agent.id }),
    })

    const { status, body } = await parseResponse<{ error: string }>(response)

    expect(status).toBe(400)
    expect(body.error).toBe('Missing section or sectionData')
  })

  it('returns 404 when agent does not exist', async () => {
    const request = createRequest({
      section: 'purpose',
      sectionData: { description: 'test' },
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: 'nonexistent-id' }),
    })

    const { status, body } = await parseResponse<{ error: string }>(response)

    expect(status).toBe(404)
    expect(body.error).toBe('Agent not found')
  })

  it('response has suggestions, ideas, and questions arrays', async () => {
    const agent = createTestAgent()

    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        suggestions: [],
        ideas: [],
        questions: [],
      })
    )

    const request = createRequest({
      section: 'identity',
      sectionData: { name: 'Fixie', tone: 'friendly' },
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: agent.id }),
    })

    const { status, body } = await parseResponse<EnrichmentResponse>(response)

    expect(status).toBe(200)
    expect(Array.isArray(body.suggestions)).toBe(true)
    expect(Array.isArray(body.ideas)).toBe(true)
    expect(Array.isArray(body.questions)).toBe(true)
  })

  it('returns empty arrays when Claude response is malformed JSON', async () => {
    const agent = createTestAgent()

    mockChat.mockResolvedValueOnce('this is not valid json at all')

    const request = createRequest({
      section: 'purpose',
      sectionData: { description: 'test agent' },
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: agent.id }),
    })

    const { status, body } = await parseResponse<EnrichmentResponse>(response)

    expect(status).toBe(200)
    expect(body.suggestions).toEqual([])
    expect(body.ideas).toEqual([])
    expect(body.questions).toEqual([])
  })

  it('strips markdown code fences from Claude response before parsing', async () => {
    const agent = createTestAgent()

    mockChat.mockResolvedValueOnce(
      '```json\n' +
        JSON.stringify({
          suggestions: [{ field: 'name', original: 'Fixie', improved: 'FixBot', reason: 'More descriptive' }],
          ideas: [],
          questions: [],
        }) +
        '\n```'
    )

    const request = createRequest({
      section: 'identity',
      sectionData: { name: 'Fixie' },
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: agent.id }),
    })

    const { status, body } = await parseResponse<EnrichmentResponse>(response)

    expect(status).toBe(200)
    expect(body.suggestions).toHaveLength(1)
    expect(body.suggestions[0].improved).toBe('FixBot')
  })

  it('fills in missing arrays when Claude returns partial response', async () => {
    const agent = createTestAgent()

    // Claude returns only suggestions, no ideas or questions keys
    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        suggestions: [{ field: 'tone', original: 'friendly', improved: 'warm and approachable', reason: 'More specific' }],
      })
    )

    const request = createRequest({
      section: 'identity',
      sectionData: { tone: 'friendly' },
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: agent.id }),
    })

    const { status, body } = await parseResponse<EnrichmentResponse>(response)

    expect(status).toBe(200)
    expect(body.suggestions).toHaveLength(1)
    expect(body.ideas).toEqual([])
    expect(body.questions).toEqual([])
  })

  it('uses agent config from database when fullConfig is not provided', async () => {
    const agent = createTestAgent()

    mockChat.mockResolvedValueOnce(
      JSON.stringify({ suggestions: [], ideas: [], questions: [] })
    )

    const request = createRequest({
      section: 'purpose',
      sectionData: { description: 'test' },
      // no fullConfig provided
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: agent.id }),
    })

    const { status } = await parseResponse<EnrichmentResponse>(response)

    expect(status).toBe(200)
    // Verify chat was called (meaning it fetched config from DB and built prompt)
    expect(mockChat).toHaveBeenCalledTimes(1)
  })

  it('calls chat with correct system prompt and enrichment prompt', async () => {
    const agent = createTestAgent()

    mockChat.mockResolvedValueOnce(
      JSON.stringify({ suggestions: [], ideas: [], questions: [] })
    )

    const sectionData = { description: 'My test agent', tasks: ['Task A'] }

    const request = createRequest({
      section: 'purpose',
      sectionData,
      fullConfig: sampleAgentConfig,
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: agent.id }),
    })

    expect(response.status).toBe(200)
    expect(mockChat).toHaveBeenCalledTimes(1)

    const callArgs = mockChat.mock.calls[0]
    // First arg is system prompt
    expect(callArgs[0]).toContain('agent configuration expert')
    // Second arg is messages array
    expect(callArgs[1]).toHaveLength(1)
    expect(callArgs[1][0].role).toBe('user')
    // The user message should contain the section data
    expect(callArgs[1][0].content).toContain('My test agent')
    // Third arg is options with maxTokens
    expect(callArgs[2]).toEqual({ maxTokens: 1024 })
  })
})
