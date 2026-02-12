// =============================================================================
// Agent OS -- Engine Tool-Use Loop Tests
// =============================================================================
// Tests for the agentic tool-use loop in processMessage() when mcpServers
// is provided. Verifies routing, tool execution, guardrails, and turn counting
// in the MCP-enabled code path.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processMessage } from '@/lib/runtime/engine'
import { chat, chatWithTools } from '@/lib/claude'
import { sampleAgentConfig } from '../helpers/fixtures'
import { buildRuntimeSystemPrompt } from '@/lib/runtime/prompt'
import type { McpServerDefinition } from '@/lib/runtime/tools.types'

// ---------------------------------------------------------------------------
// Mock MCP SDK modules (must be before imports that trigger them)
// ---------------------------------------------------------------------------

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  class MockClient {
    connect = vi.fn().mockResolvedValue(undefined)
    close = vi.fn().mockResolvedValue(undefined)
    listTools = vi.fn().mockResolvedValue({
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
      ],
    })
    callTool = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'File content here' }],
      isError: false,
    })
  }
  return { Client: MockClient }
})

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => {
  class MockStdioClientTransport {}
  return { StdioClientTransport: MockStdioClientTransport }
})

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => {
  class MockSSEClientTransport {}
  return { SSEClientTransport: MockSSEClientTransport }
})

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => {
  class MockStreamableHTTPClientTransport {}
  return { StreamableHTTPClientTransport: MockStreamableHTTPClientTransport }
})

// ---------------------------------------------------------------------------
// Typed mock references (setup.ts already mocks @/lib/claude globally)
// ---------------------------------------------------------------------------

const mockedChat = vi.mocked(chat)
const mockedChatWithTools = vi.mocked(chatWithTools)

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const systemPrompt = buildRuntimeSystemPrompt(sampleAgentConfig)

const mcpServers: McpServerDefinition[] = [
  {
    name: 'filesystem',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
  },
]

/** Helper to build a mock Anthropic.Message with sensible defaults. */
function mockMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg_mock',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Mock tool response' }],
    stop_reason: 'end_turn',
    model: 'claude-sonnet-4-5-20250929',
    usage: { input_tokens: 0, output_tokens: 0 },
    ...overrides,
  } as any
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processMessage — tool-use loop', () => {
  beforeEach(() => {
    mockedChat.mockReset()
    mockedChat.mockResolvedValue('Hello from chat path')

    mockedChatWithTools.mockReset()
    mockedChatWithTools.mockResolvedValue(mockMessage())
  })

  // ── 1. End-turn response (no tools used) ──────────────────────────

  it('returns text response when chatWithTools returns end_turn immediately', async () => {
    mockedChatWithTools.mockResolvedValueOnce(
      mockMessage({
        content: [{ type: 'text', text: 'Direct answer, no tools needed.' }],
        stop_reason: 'end_turn',
      })
    )

    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      0,
      0,
      [],
      'What is 2+2?',
      mcpServers
    )

    expect(result.response.role).toBe('assistant')
    expect(result.response.content).toBe('Direct answer, no tools needed.')
    expect(result.toolExecutions).toBeUndefined()
    expect(result.response.toolUses).toBeUndefined()
    expect(mockedChatWithTools).toHaveBeenCalledTimes(1)
  })

  // ── 2. Single tool-use loop ───────────────────────────────────────

  it('executes tool and returns final text after a tool_use round trip', async () => {
    mockedChatWithTools
      .mockResolvedValueOnce(
        mockMessage({
          id: 'msg_1',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'filesystem__read_file',
              input: { path: '/test.txt' },
            },
          ],
          stop_reason: 'tool_use',
        })
      )
      .mockResolvedValueOnce(
        mockMessage({
          id: 'msg_2',
          content: [{ type: 'text', text: 'I read the file.' }],
          stop_reason: 'end_turn',
        })
      )

    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      0,
      0,
      [],
      'Read /test.txt for me',
      mcpServers
    )

    expect(result.response.content).toBe('I read the file.')
    expect(result.toolExecutions).toBeDefined()
    expect(result.toolExecutions).toHaveLength(1)
    expect(result.toolExecutions![0].toolName).toBe('read_file')
    expect(result.toolExecutions![0].serverName).toBe('filesystem')
    expect(result.toolExecutions![0].input).toEqual({ path: '/test.txt' })
    expect(result.toolExecutions![0].isError).toBe(false)

    // chatWithTools called twice: tool_use + end_turn
    expect(mockedChatWithTools).toHaveBeenCalledTimes(2)
  })

  // ── 3. Fallback to chat() without mcpServers ──────────────────────

  it('uses the regular chat() path when mcpServers is undefined', async () => {
    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      0,
      0,
      [],
      'Hello!'
      // mcpServers omitted
    )

    expect(result.response.content).toBe('Hello from chat path')
    expect(mockedChat).toHaveBeenCalledTimes(1)
    expect(mockedChatWithTools).not.toHaveBeenCalled()
  })

  // ── 4. Empty mcpServers array falls back to chat() ────────────────

  it('uses the regular chat() path when mcpServers is an empty array', async () => {
    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      0,
      0,
      [],
      'Hello!',
      [] // empty mcpServers
    )

    expect(result.response.content).toBe('Hello from chat path')
    expect(mockedChat).toHaveBeenCalledTimes(1)
    expect(mockedChatWithTools).not.toHaveBeenCalled()
  })

  // ── 5. Guardrails enforced even with mcpServers ───────────────────

  it('blocks messages when session is ended, even with mcpServers', async () => {
    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'ended',
      10,
      0,
      [],
      'Try to sneak in a message',
      mcpServers
    )

    expect(result.response.content).toBe('Session has ended')
    expect(result.response.metadata?.blocked).toBe(true)
    expect(mockedChatWithTools).not.toHaveBeenCalled()
    expect(mockedChat).not.toHaveBeenCalled()
  })

  it('blocks messages when max turns reached, even with mcpServers', async () => {
    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      50, // max_turns_per_session is 50 in sampleAgentConfig
      0,
      [],
      'One more attempt',
      mcpServers
    )

    expect(result.guardrailNotice).toContain('Maximum turns reached')
    expect(result.sessionUpdates.status).toBe('ended')
    expect(mockedChatWithTools).not.toHaveBeenCalled()
  })

  // ── 6. Session turn counting with tool path ───────────────────────

  it('increments turn count when using the tool path', async () => {
    mockedChatWithTools.mockResolvedValueOnce(
      mockMessage({
        content: [{ type: 'text', text: 'Tool path response' }],
        stop_reason: 'end_turn',
      })
    )

    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      7,
      0,
      [],
      'Another question',
      mcpServers
    )

    expect(result.sessionUpdates.turnCount).toBe(8)
    expect(result.sessionUpdates.status).toBe('active')
  })

  it('ends session on last turn via tool path', async () => {
    mockedChatWithTools.mockResolvedValueOnce(
      mockMessage({
        content: [{ type: 'text', text: 'Final answer' }],
        stop_reason: 'end_turn',
      })
    )

    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      49, // turnCount 49 -> becomes 50 = max_turns
      0,
      [],
      'Last turn message',
      mcpServers
    )

    expect(result.sessionUpdates.turnCount).toBe(50)
    expect(result.sessionUpdates.status).toBe('ended')
    expect(result.guardrailNotice).toContain('maximum 50 turns')
  })

  // ── 7. Multiple tool_use blocks in a single response ──────────────

  it('executes multiple tool_use blocks from a single response', async () => {
    mockedChatWithTools
      .mockResolvedValueOnce(
        mockMessage({
          id: 'msg_multi',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_a',
              name: 'filesystem__read_file',
              input: { path: '/file_a.txt' },
            },
            {
              type: 'tool_use',
              id: 'toolu_b',
              name: 'filesystem__read_file',
              input: { path: '/file_b.txt' },
            },
          ],
          stop_reason: 'tool_use',
        })
      )
      .mockResolvedValueOnce(
        mockMessage({
          id: 'msg_final',
          content: [{ type: 'text', text: 'I read both files.' }],
          stop_reason: 'end_turn',
        })
      )

    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      0,
      0,
      [],
      'Read both files',
      mcpServers
    )

    expect(result.response.content).toBe('I read both files.')
    expect(result.toolExecutions).toHaveLength(2)
    expect(result.toolExecutions![0].toolCallId).toBe('toolu_a')
    expect(result.toolExecutions![0].input).toEqual({ path: '/file_a.txt' })
    expect(result.toolExecutions![1].toolCallId).toBe('toolu_b')
    expect(result.toolExecutions![1].input).toEqual({ path: '/file_b.txt' })
  })

  // ── 8. Tool use records appear on the response message ────────────

  it('attaches toolUses to the response message when tools are used', async () => {
    mockedChatWithTools
      .mockResolvedValueOnce(
        mockMessage({
          content: [
            {
              type: 'tool_use',
              id: 'toolu_x',
              name: 'filesystem__read_file',
              input: { path: '/x.txt' },
            },
          ],
          stop_reason: 'tool_use',
        })
      )
      .mockResolvedValueOnce(
        mockMessage({
          content: [{ type: 'text', text: 'Done reading.' }],
          stop_reason: 'end_turn',
        })
      )

    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      0,
      0,
      [],
      'Read x.txt',
      mcpServers
    )

    // toolUses on the response message should match toolExecutions on the result
    expect(result.response.toolUses).toBeDefined()
    expect(result.response.toolUses).toHaveLength(1)
    expect(result.response.toolUses![0].toolName).toBe('read_file')
  })

  // ── 9. No toolUses when no tools were needed ──────────────────────

  it('does not attach toolUses when end_turn with no tool calls', async () => {
    mockedChatWithTools.mockResolvedValueOnce(
      mockMessage({
        content: [{ type: 'text', text: 'No tools needed for this.' }],
        stop_reason: 'end_turn',
      })
    )

    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      0,
      0,
      [],
      'Simple question',
      mcpServers
    )

    expect(result.response.toolUses).toBeUndefined()
    expect(result.toolExecutions).toBeUndefined()
  })

  // ── 10. Multi-iteration loop (two rounds of tool use) ─────────────

  it('handles multiple iterations of the tool-use loop', async () => {
    mockedChatWithTools
      // First iteration: Claude uses tool A
      .mockResolvedValueOnce(
        mockMessage({
          id: 'msg_iter1',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_iter1',
              name: 'filesystem__read_file',
              input: { path: '/first.txt' },
            },
          ],
          stop_reason: 'tool_use',
        })
      )
      // Second iteration: Claude uses tool B
      .mockResolvedValueOnce(
        mockMessage({
          id: 'msg_iter2',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_iter2',
              name: 'filesystem__read_file',
              input: { path: '/second.txt' },
            },
          ],
          stop_reason: 'tool_use',
        })
      )
      // Third iteration: Claude produces final text
      .mockResolvedValueOnce(
        mockMessage({
          id: 'msg_iter3',
          content: [{ type: 'text', text: 'Processed both files sequentially.' }],
          stop_reason: 'end_turn',
        })
      )

    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      0,
      0,
      [],
      'Process first.txt then second.txt',
      mcpServers
    )

    expect(result.response.content).toBe('Processed both files sequentially.')
    expect(result.toolExecutions).toHaveLength(2)
    expect(result.toolExecutions![0].input).toEqual({ path: '/first.txt' })
    expect(result.toolExecutions![1].input).toEqual({ path: '/second.txt' })
    expect(mockedChatWithTools).toHaveBeenCalledTimes(3)
  })

  // ── 11. chatWithTools receives tools in the options ────────────────

  it('passes Anthropic-formatted tools to chatWithTools', async () => {
    mockedChatWithTools.mockResolvedValueOnce(
      mockMessage({
        content: [{ type: 'text', text: 'Got it.' }],
        stop_reason: 'end_turn',
      })
    )

    await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'active',
      0,
      0,
      [],
      'Hello',
      mcpServers
    )

    expect(mockedChatWithTools).toHaveBeenCalledTimes(1)
    const callArgs = mockedChatWithTools.mock.calls[0]

    // First arg: system prompt
    expect(callArgs[0]).toBe(systemPrompt)

    // Second arg: messages array (should include the user message)
    const messages = callArgs[1] as Array<{ role: string; content: string }>
    expect(messages[messages.length - 1]).toEqual({
      role: 'user',
      content: 'Hello',
    })

    // Third arg: options with tools
    const options = callArgs[2] as { tools: Array<{ name: string }>; maxTokens: number }
    expect(options.tools).toBeDefined()
    expect(options.tools.length).toBeGreaterThan(0)
    // Tool name should be namespaced as serverName__toolName
    expect(options.tools[0].name).toBe('filesystem__read_file')
    expect(options.maxTokens).toBe(4096) // default when no guardrail limit
  })

  // ── 12. Escalated session blocked with mcpServers ─────────────────

  it('blocks messages when session is escalated, even with mcpServers', async () => {
    const result = await processMessage(
      systemPrompt,
      sampleAgentConfig,
      'escalated',
      5,
      3,
      [],
      'Can I still talk?',
      mcpServers
    )

    expect(result.response.content).toBe('Session has been escalated to a human')
    expect(result.response.metadata?.blocked).toBe(true)
    expect(mockedChatWithTools).not.toHaveBeenCalled()
    expect(mockedChat).not.toHaveBeenCalled()
  })
})
