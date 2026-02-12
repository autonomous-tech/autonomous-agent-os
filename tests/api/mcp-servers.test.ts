// =============================================================================
// Agent OS -- API Tests: /api/agents/[id]/mcp-servers (CRUD)
// =============================================================================
// Tests for listing, creating, updating, and deleting MCP server configurations.
// Source: src/app/api/agents/[id]/mcp-servers/route.ts
//         src/app/api/agents/[id]/mcp-servers/[serverId]/route.ts
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/agents/[id]/mcp-servers/route'
import { PATCH, DELETE } from '@/app/api/agents/[id]/mcp-servers/[serverId]/route'
import {
  getMockedPrisma,
  createTestAgent,
  cleanupDb,
  createRequest,
  parseResponse,
} from '../helpers/db'

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const AGENT_ID = 'clx1abc2def'
const SERVER_ID = 'mcp_server_1'
const BASE_URL = `http://localhost:3000/api/agents/${AGENT_ID}/mcp-servers`

/** Helper to build a mock MCP server row as it comes from the DB (JSON strings). */
function mockServerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SERVER_ID,
    agentId: AGENT_ID,
    name: 'my-mcp-server',
    transport: 'stdio',
    command: 'npx',
    url: null,
    args: JSON.stringify(['arg1']),
    env: JSON.stringify({}),
    allowedTools: JSON.stringify([]),
    blockedTools: JSON.stringify([]),
    sandboxConfig: JSON.stringify({}),
    status: 'active',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  }
}

// ===========================================================================
// Setup
// ===========================================================================

describe('MCP Servers API', () => {
  beforeEach(() => {
    cleanupDb()
  })

  // =========================================================================
  // GET /api/agents/[id]/mcp-servers
  // =========================================================================

  describe('GET /api/agents/[id]/mcp-servers', () => {
    it('returns empty array when no MCP servers exist', async () => {
      createTestAgent()
      const mocked = getMockedPrisma()
      mocked.mcpServerConfig.findMany.mockResolvedValue([])

      const request = createRequest('GET', BASE_URL)
      const response = await GET(request as any, {
        params: Promise.resolve({ id: AGENT_ID }),
      })
      const { status, body } = await parseResponse<{ servers: unknown[] }>(response)

      expect(status).toBe(200)
      expect(body.servers).toEqual([])
    })

    it('returns list of MCP servers with parsed JSON fields', async () => {
      createTestAgent()
      const mocked = getMockedPrisma()

      const row = mockServerRow()
      mocked.mcpServerConfig.findMany.mockResolvedValue([row])

      const request = createRequest('GET', BASE_URL)
      const response = await GET(request as any, {
        params: Promise.resolve({ id: AGENT_ID }),
      })
      const { status, body } = await parseResponse<{ servers: Record<string, unknown>[] }>(response)

      expect(status).toBe(200)
      expect(body.servers).toHaveLength(1)

      const server = body.servers[0]
      expect(server.id).toBe(SERVER_ID)
      expect(server.name).toBe('my-mcp-server')
      expect(server.transport).toBe('stdio')
      // JSON fields should be parsed into real objects, not strings
      expect(Array.isArray(server.args)).toBe(true)
      expect(server.args).toEqual(['arg1'])
      expect(typeof server.env).toBe('object')
      expect(Array.isArray(server.allowedTools)).toBe(true)
      expect(Array.isArray(server.blockedTools)).toBe(true)
      expect(typeof server.sandboxConfig).toBe('object')
    })

    it('returns 404 when agent does not exist', async () => {
      // Do NOT call createTestAgent -- default mock returns null for findUnique
      const request = createRequest('GET', BASE_URL)
      const response = await GET(request as any, {
        params: Promise.resolve({ id: 'nonexistent' }),
      })
      const { status, body } = await parseResponse<{ error: string }>(response)

      expect(status).toBe(404)
      expect(body.error).toMatch(/not found/i)
    })
  })

  // =========================================================================
  // POST /api/agents/[id]/mcp-servers
  // =========================================================================

  describe('POST /api/agents/[id]/mcp-servers', () => {
    it('creates a stdio server successfully', async () => {
      createTestAgent()
      const mocked = getMockedPrisma()

      // No duplicate
      mocked.mcpServerConfig.findUnique.mockResolvedValue(null)

      const createdRow = mockServerRow({
        name: 'filesystem',
        transport: 'stdio',
        command: 'npx',
        args: JSON.stringify(['-y', '@modelcontextprotocol/server-filesystem']),
        env: JSON.stringify({}),
      })
      mocked.mcpServerConfig.create.mockResolvedValue(createdRow)

      const request = createRequest('POST', BASE_URL, {
        name: 'filesystem',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
      })
      const response = await POST(request as any, {
        params: Promise.resolve({ id: AGENT_ID }),
      })
      const { status, body } = await parseResponse<Record<string, unknown>>(response)

      expect(status).toBe(201)
      expect(body.name).toBe('filesystem')
      expect(body.transport).toBe('stdio')
      expect(body.command).toBe('npx')
      expect(Array.isArray(body.args)).toBe(true)
    })

    it('creates an SSE server successfully', async () => {
      createTestAgent()
      const mocked = getMockedPrisma()

      mocked.mcpServerConfig.findUnique.mockResolvedValue(null)

      const createdRow = mockServerRow({
        name: 'remote-tools',
        transport: 'sse',
        command: null,
        url: 'https://example.com/sse',
        args: JSON.stringify([]),
      })
      mocked.mcpServerConfig.create.mockResolvedValue(createdRow)

      const request = createRequest('POST', BASE_URL, {
        name: 'remote-tools',
        transport: 'sse',
        url: 'https://example.com/sse',
      })
      const response = await POST(request as any, {
        params: Promise.resolve({ id: AGENT_ID }),
      })
      const { status, body } = await parseResponse<Record<string, unknown>>(response)

      expect(status).toBe(201)
      expect(body.name).toBe('remote-tools')
      expect(body.transport).toBe('sse')
      expect(body.url).toBe('https://example.com/sse')
    })

    it('returns 400 when name is missing', async () => {
      createTestAgent()

      const request = createRequest('POST', BASE_URL, {
        transport: 'stdio',
        command: 'npx',
      })
      const response = await POST(request as any, {
        params: Promise.resolve({ id: AGENT_ID }),
      })
      const { status, body } = await parseResponse<{ error: string }>(response)

      expect(status).toBe(400)
      expect(body.error).toMatch(/name/i)
    })

    it('returns 400 when transport is invalid', async () => {
      createTestAgent()

      const request = createRequest('POST', BASE_URL, {
        name: 'bad-transport',
        transport: 'websocket',
      })
      const response = await POST(request as any, {
        params: Promise.resolve({ id: AGENT_ID }),
      })
      const { status, body } = await parseResponse<{ error: string }>(response)

      expect(status).toBe(400)
      expect(body.error).toMatch(/transport/i)
    })

    it('returns 400 when stdio transport is missing command', async () => {
      createTestAgent()

      const request = createRequest('POST', BASE_URL, {
        name: 'no-command',
        transport: 'stdio',
      })
      const response = await POST(request as any, {
        params: Promise.resolve({ id: AGENT_ID }),
      })
      const { status, body } = await parseResponse<{ error: string }>(response)

      expect(status).toBe(400)
      expect(body.error).toMatch(/command/i)
    })

    it('returns 400 when sse transport is missing or has invalid url', async () => {
      createTestAgent()

      const request = createRequest('POST', BASE_URL, {
        name: 'no-url',
        transport: 'sse',
      })
      const response = await POST(request as any, {
        params: Promise.resolve({ id: AGENT_ID }),
      })
      const { status, body } = await parseResponse<{ error: string }>(response)

      expect(status).toBe(400)
      expect(body.error).toMatch(/url/i)
    })

    it('returns 400 when args is not an array', async () => {
      createTestAgent()

      const request = createRequest('POST', BASE_URL, {
        name: 'bad-args',
        transport: 'stdio',
        command: 'npx',
        args: 'not-an-array',
      })
      const response = await POST(request as any, {
        params: Promise.resolve({ id: AGENT_ID }),
      })
      const { status, body } = await parseResponse<{ error: string }>(response)

      expect(status).toBe(400)
      expect(body.error).toMatch(/args/i)
    })

    it('returns 400 when env is not an object', async () => {
      createTestAgent()

      const request = createRequest('POST', BASE_URL, {
        name: 'bad-env',
        transport: 'stdio',
        command: 'npx',
        env: 'string-not-object',
      })
      const response = await POST(request as any, {
        params: Promise.resolve({ id: AGENT_ID }),
      })
      const { status, body } = await parseResponse<{ error: string }>(response)

      expect(status).toBe(400)
      expect(body.error).toMatch(/env/i)
    })

    it('returns 409 when server name already exists for the agent', async () => {
      createTestAgent()
      const mocked = getMockedPrisma()

      // Simulate existing server with same name
      mocked.mcpServerConfig.findUnique.mockResolvedValue(mockServerRow({ name: 'duplicate' }))

      const request = createRequest('POST', BASE_URL, {
        name: 'duplicate',
        transport: 'stdio',
        command: 'npx',
      })
      const response = await POST(request as any, {
        params: Promise.resolve({ id: AGENT_ID }),
      })
      const { status, body } = await parseResponse<{ error: string }>(response)

      expect(status).toBe(409)
      expect(body.error).toMatch(/already exists/i)
    })

    it('returns 404 when agent does not exist', async () => {
      // Do NOT call createTestAgent
      const request = createRequest('POST', BASE_URL, {
        name: 'test',
        transport: 'stdio',
        command: 'npx',
      })
      const response = await POST(request as any, {
        params: Promise.resolve({ id: 'nonexistent' }),
      })
      const { status, body } = await parseResponse<{ error: string }>(response)

      expect(status).toBe(404)
      expect(body.error).toMatch(/not found/i)
    })
  })

  // =========================================================================
  // PATCH /api/agents/[id]/mcp-servers/[serverId]
  // =========================================================================

  describe('PATCH /api/agents/[id]/mcp-servers/[serverId]', () => {
    it('updates server name successfully', async () => {
      createTestAgent()
      const mocked = getMockedPrisma()

      const existingServer = mockServerRow()
      mocked.mcpServerConfig.findUnique.mockResolvedValue(existingServer)

      const updatedRow = mockServerRow({ name: 'renamed-server' })
      mocked.mcpServerConfig.update.mockResolvedValue(updatedRow)

      const request = createRequest('PATCH', `${BASE_URL}/${SERVER_ID}`, {
        name: 'renamed-server',
      })
      const response = await PATCH(request as any, {
        params: Promise.resolve({ id: AGENT_ID, serverId: SERVER_ID }),
      })
      const { status, body } = await parseResponse<Record<string, unknown>>(response)

      expect(status).toBe(200)
      expect(body.name).toBe('renamed-server')
    })

    it('updates server status to inactive', async () => {
      createTestAgent()
      const mocked = getMockedPrisma()

      const existingServer = mockServerRow()
      mocked.mcpServerConfig.findUnique.mockResolvedValue(existingServer)

      const updatedRow = mockServerRow({ status: 'inactive' })
      mocked.mcpServerConfig.update.mockResolvedValue(updatedRow)

      const request = createRequest('PATCH', `${BASE_URL}/${SERVER_ID}`, {
        status: 'inactive',
      })
      const response = await PATCH(request as any, {
        params: Promise.resolve({ id: AGENT_ID, serverId: SERVER_ID }),
      })
      const { status, body } = await parseResponse<Record<string, unknown>>(response)

      expect(status).toBe(200)
      expect(body.status).toBe('inactive')
    })

    it('returns 400 for unknown fields', async () => {
      createTestAgent()
      const mocked = getMockedPrisma()

      const existingServer = mockServerRow()
      mocked.mcpServerConfig.findUnique.mockResolvedValue(existingServer)

      const request = createRequest('PATCH', `${BASE_URL}/${SERVER_ID}`, {
        unknownField: 'value',
      })
      const response = await PATCH(request as any, {
        params: Promise.resolve({ id: AGENT_ID, serverId: SERVER_ID }),
      })
      const { status, body } = await parseResponse<{ error: string }>(response)

      expect(status).toBe(400)
      expect(body.error).toMatch(/not allowed/i)
    })

    it('returns 400 when changing transport to sse without url', async () => {
      createTestAgent()
      const mocked = getMockedPrisma()

      // Existing server is stdio with command but no url
      const existingServer = mockServerRow({
        transport: 'stdio',
        command: 'npx',
        url: null,
      })
      mocked.mcpServerConfig.findUnique.mockResolvedValue(existingServer)

      const request = createRequest('PATCH', `${BASE_URL}/${SERVER_ID}`, {
        transport: 'sse',
      })
      const response = await PATCH(request as any, {
        params: Promise.resolve({ id: AGENT_ID, serverId: SERVER_ID }),
      })
      const { status, body } = await parseResponse<{ error: string }>(response)

      expect(status).toBe(400)
      expect(body.error).toMatch(/url/i)
    })

    it('returns 404 when server does not exist', async () => {
      createTestAgent()
      const mocked = getMockedPrisma()

      mocked.mcpServerConfig.findUnique.mockResolvedValue(null)

      const request = createRequest('PATCH', `${BASE_URL}/nonexistent`, {
        name: 'new-name',
      })
      const response = await PATCH(request as any, {
        params: Promise.resolve({ id: AGENT_ID, serverId: 'nonexistent' }),
      })
      const { status, body } = await parseResponse<{ error: string }>(response)

      expect(status).toBe(404)
      expect(body.error).toMatch(/not found/i)
    })

    it('returns 404 when server belongs to a different agent', async () => {
      createTestAgent()
      const mocked = getMockedPrisma()

      // Server exists but belongs to a different agent
      const serverForOtherAgent = mockServerRow({ agentId: 'other-agent-id' })
      mocked.mcpServerConfig.findUnique.mockResolvedValue(serverForOtherAgent)

      const request = createRequest('PATCH', `${BASE_URL}/${SERVER_ID}`, {
        name: 'renamed',
      })
      const response = await PATCH(request as any, {
        params: Promise.resolve({ id: AGENT_ID, serverId: SERVER_ID }),
      })
      const { status, body } = await parseResponse<{ error: string }>(response)

      expect(status).toBe(404)
      expect(body.error).toMatch(/not found/i)
    })
  })

  // =========================================================================
  // DELETE /api/agents/[id]/mcp-servers/[serverId]
  // =========================================================================

  describe('DELETE /api/agents/[id]/mcp-servers/[serverId]', () => {
    it('deletes server successfully', async () => {
      createTestAgent()
      const mocked = getMockedPrisma()

      const existingServer = mockServerRow()
      mocked.mcpServerConfig.findUnique.mockResolvedValue(existingServer)
      mocked.mcpServerConfig.delete.mockResolvedValue(existingServer)

      const request = createRequest('DELETE', `${BASE_URL}/${SERVER_ID}`)
      const response = await DELETE(request as any, {
        params: Promise.resolve({ id: AGENT_ID, serverId: SERVER_ID }),
      })
      const { status, body } = await parseResponse<{ deleted: boolean }>(response)

      expect(status).toBe(200)
      expect(body.deleted).toBe(true)

      // Verify delete was called with the correct ID
      expect(mocked.mcpServerConfig.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SERVER_ID } })
      )
    })

    it('returns 404 when server does not exist', async () => {
      createTestAgent()
      const mocked = getMockedPrisma()

      mocked.mcpServerConfig.findUnique.mockResolvedValue(null)

      const request = createRequest('DELETE', `${BASE_URL}/nonexistent`)
      const response = await DELETE(request as any, {
        params: Promise.resolve({ id: AGENT_ID, serverId: 'nonexistent' }),
      })
      const { status, body } = await parseResponse<{ error: string }>(response)

      expect(status).toBe(404)
      expect(body.error).toMatch(/not found/i)
    })

    it('returns 404 when agent does not exist', async () => {
      // Do NOT call createTestAgent -- default mock returns null
      const request = createRequest('DELETE', `${BASE_URL}/${SERVER_ID}`)
      const response = await DELETE(request as any, {
        params: Promise.resolve({ id: 'nonexistent', serverId: SERVER_ID }),
      })
      const { status, body } = await parseResponse<{ error: string }>(response)

      expect(status).toBe(404)
      expect(body.error).toMatch(/not found/i)
    })
  })
})
