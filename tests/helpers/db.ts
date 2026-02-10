// =============================================================================
// Agent OS -- Test Database Helpers
// =============================================================================
// Helpers for creating and cleaning up test data. These use the mocked Prisma
// client from setup.ts for unit tests. For integration tests, they can be
// pointed at a real test database.
// =============================================================================

import { prisma } from '@/lib/db'
import {
  createMockAgentProject,
  createMockTemplate,
  sampleAgentConfig,
  sampleStageData,
} from './fixtures'
import type { vi as Vi } from 'vitest'

type MockedFunction = ReturnType<typeof Vi.fn>

// ---------------------------------------------------------------------------
// Helper to get the mocked Prisma client with proper typing
// ---------------------------------------------------------------------------

export function getMockedPrisma() {
  return prisma as unknown as {
    agentProject: {
      findMany: MockedFunction
      findUnique: MockedFunction
      findFirst: MockedFunction
      create: MockedFunction
      update: MockedFunction
      delete: MockedFunction
      count: MockedFunction
    }
    agentTemplate: {
      findMany: MockedFunction
      findUnique: MockedFunction
      findFirst: MockedFunction
      create: MockedFunction
    }
  }
}

// ---------------------------------------------------------------------------
// createTestAgent -- sets up the mock to return a sensible default agent
// ---------------------------------------------------------------------------

export function createTestAgent(overrides: Record<string, unknown> = {}) {
  const agent = createMockAgentProject(overrides)
  const mocked = getMockedPrisma()

  // Configure findUnique to return this agent when queried by ID
  mocked.agentProject.findUnique.mockImplementation(
    (args: { where: { id?: string; slug?: string } }) => {
      if (args.where.id === agent.id || args.where.slug === agent.slug) {
        return Promise.resolve(agent)
      }
      return Promise.resolve(null)
    }
  )

  // Configure create to return this agent
  mocked.agentProject.create.mockResolvedValue(agent)

  return agent
}

// ---------------------------------------------------------------------------
// createTestTemplate -- sets up the mock to return a template
// ---------------------------------------------------------------------------

export function createTestTemplate(overrides: Record<string, unknown> = {}) {
  const template = createMockTemplate(overrides)
  const mocked = getMockedPrisma()

  mocked.agentTemplate.findUnique.mockImplementation(
    (args: { where: { id?: string } }) => {
      if (args.where.id === template.id) {
        return Promise.resolve(template)
      }
      return Promise.resolve(null)
    }
  )

  return template
}

// ---------------------------------------------------------------------------
// cleanupDb -- resets all mock implementations and call histories
// ---------------------------------------------------------------------------

export function cleanupDb() {
  const mocked = getMockedPrisma()

  // Reset AgentProject mocks
  Object.values(mocked.agentProject).forEach((fn) => {
    ;(fn as MockedFunction).mockReset()
  })

  // Reset AgentTemplate mocks
  Object.values(mocked.agentTemplate).forEach((fn) => {
    ;(fn as MockedFunction).mockReset()
  })

  // Re-set default resolved values
  mocked.agentProject.findMany.mockResolvedValue([])
  mocked.agentProject.findUnique.mockResolvedValue(null)
  mocked.agentProject.findFirst.mockResolvedValue(null)
  mocked.agentProject.create.mockResolvedValue(null)
  mocked.agentProject.update.mockResolvedValue(null)
  mocked.agentProject.delete.mockResolvedValue(null)
  mocked.agentProject.count.mockResolvedValue(0)
  mocked.agentTemplate.findMany.mockResolvedValue([])
  mocked.agentTemplate.findUnique.mockResolvedValue(null)
  mocked.agentTemplate.findFirst.mockResolvedValue(null)
  mocked.agentTemplate.create.mockResolvedValue(null)
}

// ---------------------------------------------------------------------------
// Utility: create a minimal Request object for testing API route handlers
// ---------------------------------------------------------------------------

export function createRequest(
  method: string,
  url: string,
  body?: unknown,
  headers?: Record<string, string>
): Request {
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }

  if (body && method !== 'GET') {
    init.body = JSON.stringify(body)
  }

  return new Request(url, init)
}

// ---------------------------------------------------------------------------
// Utility: parse a JSON Response for assertions
// ---------------------------------------------------------------------------

export async function parseResponse<T = unknown>(
  response: Response
): Promise<{ status: number; body: T }> {
  const status = response.status
  const body = (await response.json()) as T
  return { status, body }
}
