import { describe, it, expect, beforeEach } from 'vitest'
import { GET } from '@/app/api/agents/[id]/claude-code-export/route'
import { createTestAgent, cleanupDb, createRequest, parseResponse } from '../helpers/db'

describe('GET /api/agents/[id]/claude-code-export', () => {
  beforeEach(() => {
    cleanupDb()
  })

  it('returns generated files for agent', async () => {
    const agent = createTestAgent({ slug: 'fixie' })
    const request = createRequest('GET', 'http://test/api/agents/test-id/claude-code-export')

    const response = await GET(request, {
      params: Promise.resolve({ id: agent.id }),
    })

    const { status, body } = await parseResponse<{
      files: {
        agentMd: { path: string; content: string }
        mcpJson: { path: string; content: string }
        settingsJson: { path: string; content: string }
        metadata: { slug: string; name: string; hasLetta: boolean }
      }
    }>(response)

    expect(status).toBe(200)
    expect(body.files.agentMd.path).toBe('.claude/agents/fixie.md')
    expect(body.files.agentMd.content).toContain('name: fixie')
    expect(body.files.mcpJson.path).toBe('.mcp.json')
    expect(body.files.settingsJson.path).toBe('.claude/settings.json')
    expect(body.files.metadata.slug).toBe('fixie')
    expect(body.files.metadata.name).toBe('Fixie')
  })

  it('uses custom URL when provided', async () => {
    const agent = createTestAgent({ slug: 'fixie' })
    const request = createRequest(
      'GET',
      'http://test/api/agents/test-id/claude-code-export?url=https://my-agent-os.com'
    )

    const response = await GET(request, {
      params: Promise.resolve({ id: agent.id }),
    })

    const { status, body } = await parseResponse<{
      files: {
        mcpJson: { content: string }
        settingsJson: { content: string }
      }
    }>(response)

    expect(status).toBe(200)
    expect(body.files.mcpJson.content).toContain('https://my-agent-os.com')
    expect(body.files.settingsJson.content).toContain('https://my-agent-os.com')
  })

  it('sets hasLetta true when agent has lettaAgentId', async () => {
    const agent = createTestAgent({ slug: 'fixie', lettaAgentId: 'letta-xyz' })
    const request = createRequest('GET', 'http://test/api/agents/test-id/claude-code-export')

    const response = await GET(request, {
      params: Promise.resolve({ id: agent.id }),
    })

    const { status, body } = await parseResponse<{
      files: {
        agentMd: { content: string }
        metadata: { hasLetta: boolean }
      }
    }>(response)

    expect(status).toBe(200)
    expect(body.files.metadata.hasLetta).toBe(true)
    expect(body.files.agentMd.content).toContain('## Memory Protocol')
  })

  it('sets hasLetta false when agent has no lettaAgentId', async () => {
    const agent = createTestAgent({ slug: 'fixie', lettaAgentId: null })
    const request = createRequest('GET', 'http://test/api/agents/test-id/claude-code-export')

    const response = await GET(request, {
      params: Promise.resolve({ id: agent.id }),
    })

    const { status, body } = await parseResponse<{
      files: {
        agentMd: { content: string }
        metadata: { hasLetta: boolean }
      }
    }>(response)

    expect(status).toBe(200)
    expect(body.files.metadata.hasLetta).toBe(false)
    // Memory Protocol is always included per AGENT-MD-SPEC
    expect(body.files.agentMd.content).toContain('## Memory Protocol')
  })

  it('returns 404 when agent not found', async () => {
    const request = createRequest('GET', 'http://test/api/agents/nonexistent/claude-code-export')

    const response = await GET(request, {
      params: Promise.resolve({ id: 'nonexistent' }),
    })

    const { status, body } = await parseResponse<{ error: string }>(response)
    expect(status).toBe(404)
    expect(body.error).toBe('Agent not found')
  })
})
