import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock MCP SDK modules ──────────────────────────────────────────────
// These must be declared before importing the module under test.

const mockConnect = vi.fn().mockResolvedValue(undefined)
const mockClose = vi.fn().mockResolvedValue(undefined)
const mockListTools = vi.fn().mockResolvedValue({
  tools: [
    {
      name: 'read_file',
      description: 'Read a file',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description: 'Write a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'list_dir',
      description: 'List directory',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' } },
      },
    },
  ],
})
const mockCallTool = vi.fn().mockResolvedValue({
  content: [{ type: 'text', text: 'Tool output result' }],
  isError: false,
})

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  // Use a regular function (not arrow) so it can be called with `new`
  function MockClient() {
    // @ts-expect-error -- mock constructor
    this.connect = mockConnect
    // @ts-expect-error -- mock constructor
    this.close = mockClose
    // @ts-expect-error -- mock constructor
    this.listTools = mockListTools
    // @ts-expect-error -- mock constructor
    this.callTool = mockCallTool
  }
  return { Client: MockClient }
})

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => {
  function MockStdioTransport() {}
  return { StdioClientTransport: MockStdioTransport }
})

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => {
  function MockSSETransport() {}
  return { SSEClientTransport: MockSSETransport }
})

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => {
  function MockHTTPTransport() {}
  return { StreamableHTTPClientTransport: MockHTTPTransport }
})

import {
  matchesGlob,
  resolveServerForTool,
  McpClientManager,
} from '@/lib/runtime/mcp-client'
import type { McpServerDefinition } from '@/lib/runtime/tools.types'

// ── Helpers ───────────────────────────────────────────────────────────

function makeServer(overrides: Partial<McpServerDefinition> = {}): McpServerDefinition {
  return {
    name: 'filesystem',
    transport: 'stdio',
    command: 'node',
    args: ['server.js'],
    ...overrides,
  }
}

// ── matchesGlob ──────────────────────────────────────────────────────

describe('matchesGlob', () => {
  it('matches exact names', () => {
    expect(matchesGlob('read_file', 'read_file')).toBe(true)
  })

  it('matches wildcard at end', () => {
    expect(matchesGlob('read*', 'read_file')).toBe(true)
  })

  it('matches wildcard at start', () => {
    expect(matchesGlob('*write', 'fs_write')).toBe(true)
  })

  it('matches wildcard in middle', () => {
    expect(matchesGlob('fs_*_file', 'fs_read_file')).toBe(true)
  })

  it('rejects non-matching patterns', () => {
    expect(matchesGlob('read*', 'write_file')).toBe(false)
  })

  it('single wildcard matches anything', () => {
    expect(matchesGlob('*', 'anything')).toBe(true)
  })
})

// ── resolveServerForTool ─────────────────────────────────────────────

describe('resolveServerForTool', () => {
  const servers: McpServerDefinition[] = [
    makeServer({ name: 'filesystem' }),
    makeServer({ name: 'database' }),
  ]

  it('parses serverName from namespaced tool name and returns it if known', () => {
    expect(resolveServerForTool('filesystem__read_file', servers)).toBe('filesystem')
  })

  it('returns undefined for non-namespaced names', () => {
    expect(resolveServerForTool('read_file', servers)).toBeUndefined()
  })

  it('returns undefined if parsed server name is not in the definitions', () => {
    expect(resolveServerForTool('unknown__read_file', servers)).toBeUndefined()
  })
})

// ── McpClientManager ─────────────────────────────────────────────────

describe('McpClientManager', () => {
  let manager: McpClientManager

  beforeEach(() => {
    manager = new McpClientManager()
    vi.clearAllMocks()
    // Restore default mock implementations after clearAllMocks
    mockConnect.mockResolvedValue(undefined)
    mockClose.mockResolvedValue(undefined)
    mockListTools.mockResolvedValue({
      tools: [
        {
          name: 'read_file',
          description: 'Read a file',
          inputSchema: {
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path'],
          },
        },
        {
          name: 'write_file',
          description: 'Write a file',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['path', 'content'],
          },
        },
        {
          name: 'list_dir',
          description: 'List directory',
          inputSchema: {
            type: 'object',
            properties: { path: { type: 'string' } },
          },
        },
      ],
    })
    mockCallTool.mockResolvedValue({
      content: [{ type: 'text', text: 'Tool output result' }],
      isError: false,
    })
  })

  // ── connect() ────────────────────────────────────────────────────

  describe('connect()', () => {
    it('connects to active servers', async () => {
      await manager.connect([makeServer()])
      expect(manager.connectedCount).toBe(1)
      expect(manager.isConnected('filesystem')).toBe(true)
    })

    it('skips inactive servers', async () => {
      await manager.connect([makeServer({ status: 'inactive' })])
      expect(manager.connectedCount).toBe(0)
      expect(manager.isConnected('filesystem')).toBe(false)
    })

    it('handles connection failures gracefully without throwing', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Connection refused'))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await expect(manager.connect([makeServer()])).resolves.not.toThrow()
      expect(manager.connectedCount).toBe(0)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to connect'),
        expect.stringContaining('Connection refused')
      )

      warnSpy.mockRestore()
    })
  })

  // ── connectedCount & isConnected() ───────────────────────────────

  describe('connectedCount / isConnected()', () => {
    it('returns 0 with no connections', () => {
      expect(manager.connectedCount).toBe(0)
    })

    it('returns correct count after connecting multiple servers', async () => {
      await manager.connect([
        makeServer({ name: 'server-a' }),
        makeServer({ name: 'server-b' }),
      ])
      expect(manager.connectedCount).toBe(2)
      expect(manager.isConnected('server-a')).toBe(true)
      expect(manager.isConnected('server-b')).toBe(true)
      expect(manager.isConnected('server-c')).toBe(false)
    })
  })

  // ── listTools() ──────────────────────────────────────────────────

  describe('listTools()', () => {
    it('returns tools from all connected servers', async () => {
      await manager.connect([makeServer()])
      const tools = await manager.listTools()
      expect(tools).toHaveLength(3)
      expect(tools[0].name).toBe('read_file')
      expect(tools[0].serverName).toBe('filesystem')
    })

    it('applies allowedTools filter', async () => {
      await manager.connect([
        makeServer({ allowedTools: ['read*'] }),
      ])
      const tools = await manager.listTools()
      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe('read_file')
    })

    it('applies blockedTools filter', async () => {
      await manager.connect([
        makeServer({ blockedTools: ['write*'] }),
      ])
      const tools = await manager.listTools()
      expect(tools).toHaveLength(2)
      expect(tools.map((t) => t.name)).toEqual(['read_file', 'list_dir'])
    })

    it('caches results on second call', async () => {
      await manager.connect([makeServer()])
      const first = await manager.listTools()
      const second = await manager.listTools()
      // listTools on the client should have been called only once
      expect(mockListTools).toHaveBeenCalledTimes(1)
      expect(first).toBe(second) // Same reference
    })
  })

  // ── toAnthropicTools() ───────────────────────────────────────────

  describe('toAnthropicTools()', () => {
    it('returns tools in Anthropic API format with namespaced names', async () => {
      await manager.connect([makeServer()])
      const anthropicTools = await manager.toAnthropicTools()

      expect(anthropicTools).toHaveLength(3)

      const firstTool = anthropicTools[0]
      expect(firstTool.name).toBe('filesystem__read_file')
      expect(firstTool.description).toBe('Read a file')
      expect(firstTool.input_schema.type).toBe('object')
      expect(firstTool.input_schema.properties).toEqual({ path: { type: 'string' } })
      expect(firstTool.input_schema.required).toEqual(['path'])
    })
  })

  // ── executeTool() ────────────────────────────────────────────────

  describe('executeTool()', () => {
    it('dispatches tool call to correct server and returns ToolResult', async () => {
      await manager.connect([makeServer()])
      const result = await manager.executeTool({
        id: 'call-1',
        name: 'read_file',
        input: { path: '/tmp/test.txt' },
        serverName: 'filesystem',
      })

      expect(result.toolCallId).toBe('call-1')
      expect(result.output).toBe('Tool output result')
      expect(result.isError).toBe(false)
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('returns error when server is not connected', async () => {
      await manager.connect([makeServer()])
      const result = await manager.executeTool({
        id: 'call-2',
        name: 'read_file',
        input: { path: '/tmp/test.txt' },
        serverName: 'unknown',
      })

      expect(result.isError).toBe(true)
      expect(result.output).toContain('server "unknown" is not connected')
    })

    it('returns error when serverName is missing and tool name is not namespaced', async () => {
      await manager.connect([makeServer()])
      const result = await manager.executeTool({
        id: 'call-3',
        name: 'read_file',
        input: { path: '/tmp/test.txt' },
      })

      expect(result.isError).toBe(true)
      expect(result.output).toContain('cannot determine server')
    })

    it('parses serverName from namespaced tool name when serverName is omitted', async () => {
      await manager.connect([makeServer()])
      const result = await manager.executeTool({
        id: 'call-4',
        name: 'filesystem__read_file',
        input: { path: '/tmp/test.txt' },
      })

      expect(result.toolCallId).toBe('call-4')
      expect(result.output).toBe('Tool output result')
      expect(result.isError).toBe(false)
      // Verify callTool was called with the un-namespaced tool name
      expect(mockCallTool).toHaveBeenCalledWith(
        { name: 'read_file', arguments: { path: '/tmp/test.txt' } },
        undefined,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })
  })

  // ── disconnect() ─────────────────────────────────────────────────

  describe('disconnect()', () => {
    it('closes all connections and resets state', async () => {
      await manager.connect([
        makeServer({ name: 'server-a' }),
        makeServer({ name: 'server-b' }),
      ])
      expect(manager.connectedCount).toBe(2)

      // Populate tool cache
      await manager.listTools()

      await manager.disconnect()

      expect(manager.connectedCount).toBe(0)
      expect(manager.isConnected('server-a')).toBe(false)
      expect(manager.isConnected('server-b')).toBe(false)
      expect(mockClose).toHaveBeenCalledTimes(2)

      // Tool cache should be cleared — next listTools should call client again
      // (but there are no servers, so result will be empty)
      const tools = await manager.listTools()
      expect(tools).toHaveLength(0)
    })
  })
})
