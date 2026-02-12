// =============================================================================
// Agent OS -- Test Setup
// =============================================================================
// Global mocks for Prisma client and Anthropic SDK.
// These are applied before every vitest test file runs.
// =============================================================================

import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Prisma Client
// ---------------------------------------------------------------------------
// We intercept `@/lib/db` so that every module importing `prisma` gets our
// mock instead of a real database connection.
// ---------------------------------------------------------------------------

vi.mock('@/lib/db', () => {
  const mockPrisma = {
    agentProject: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    agentTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(null),
    },
    deployment: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(null),
    },
    chatSession: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(null),
    },
    mcpServerConfig: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(null),
    },
    toolExecutionLog: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(null),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  }

  return { prisma: mockPrisma }
})

// ---------------------------------------------------------------------------
// Mock Anthropic SDK
// ---------------------------------------------------------------------------
// We intercept `@/lib/claude` so that no real API calls are made during tests.
// Individual tests can override these mocks for specific scenarios.
// ---------------------------------------------------------------------------

vi.mock('@/lib/claude', () => {
  return {
    chatWithTools: vi.fn().mockResolvedValue({
      id: 'msg_mock',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Mock tool response' }],
      stop_reason: 'end_turn',
      model: 'claude-sonnet-4-5-20250929',
      usage: { input_tokens: 0, output_tokens: 0 },
    }),
    chat: vi.fn().mockResolvedValue(
      JSON.stringify({
        reply: 'Mock response from the builder.',
        previewUpdates: [],
        quickReplies: ['Sounds good', 'Tell me more'],
        stageStatus: 'draft',
      })
    ),
    inferFromDescription: vi.fn().mockResolvedValue({
      name: 'Test Agent',
      config: {
        mission: {
          description: 'A test agent for unit testing',
          tasks: ['Task 1', 'Task 2'],
          exclusions: ['Do not do bad things'],
          audience: { primary: 'Developers', scope: 'team' },
        },
        identity: {
          name: 'Test Agent',
          tone: 'friendly',
          vibe: 'Helpful and efficient',
          greeting: 'Hi! I am Test Agent.',
        },
        capabilities: {
          tools: [
            {
              name: 'Code Search',
              access: 'read-only',
              description: 'Search the codebase',
            },
          ],
        },
        memory: {
          strategy: 'conversational',
          remember: ['User preferences'],
          daily_logs: true,
          curated_memory: true,
          max_memory_size: '500 lines',
        },
        triggers: {
          triggers: [
            { type: 'message', description: 'Responds when user sends a message' },
          ],
        },
        guardrails: {
          behavioral: ['Stay on topic'],
          prompt_injection_defense: 'strict',
          resource_limits: {
            max_turns_per_session: 50,
            escalation_threshold: 3,
          },
        },
      },
    }),
  }
})
