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
    deployment: {
      findMany: MockedFunction
      findUnique: MockedFunction
      findFirst: MockedFunction
      create: MockedFunction
      update: MockedFunction
      delete: MockedFunction
    }
    chatSession: {
      findMany: MockedFunction
      findUnique: MockedFunction
      findFirst: MockedFunction
      create: MockedFunction
      update: MockedFunction
      delete: MockedFunction
    }
    mcpServerConfig: {
      findMany: MockedFunction
      findUnique: MockedFunction
      findFirst: MockedFunction
      create: MockedFunction
      update: MockedFunction
      delete: MockedFunction
    }
    toolExecutionLog: {
      findMany: MockedFunction
      create: MockedFunction
      createMany: MockedFunction
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

  // Reset Deployment mocks
  Object.values(mocked.deployment).forEach((fn) => {
    ;(fn as MockedFunction).mockReset()
  })

  // Reset ChatSession mocks
  Object.values(mocked.chatSession).forEach((fn) => {
    ;(fn as MockedFunction).mockReset()
  })

  // Reset McpServerConfig mocks
  Object.values(mocked.mcpServerConfig).forEach((fn) => {
    ;(fn as MockedFunction).mockReset()
  })

  // Reset ToolExecutionLog mocks
  Object.values(mocked.toolExecutionLog).forEach((fn) => {
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
  mocked.deployment.findMany.mockResolvedValue([])
  mocked.deployment.findUnique.mockResolvedValue(null)
  mocked.deployment.findFirst.mockResolvedValue(null)
  mocked.deployment.create.mockResolvedValue(null)
  mocked.deployment.update.mockResolvedValue(null)
  mocked.deployment.delete.mockResolvedValue(null)
  mocked.chatSession.findMany.mockResolvedValue([])
  mocked.chatSession.findUnique.mockResolvedValue(null)
  mocked.chatSession.findFirst.mockResolvedValue(null)
  mocked.chatSession.create.mockResolvedValue(null)
  mocked.chatSession.update.mockResolvedValue(null)
  mocked.chatSession.delete.mockResolvedValue(null)
  mocked.mcpServerConfig.findMany.mockResolvedValue([])
  mocked.mcpServerConfig.findUnique.mockResolvedValue(null)
  mocked.mcpServerConfig.findFirst.mockResolvedValue(null)
  mocked.mcpServerConfig.create.mockResolvedValue(null)
  mocked.mcpServerConfig.update.mockResolvedValue(null)
  mocked.mcpServerConfig.delete.mockResolvedValue(null)
  mocked.toolExecutionLog.findMany.mockResolvedValue([])
  mocked.toolExecutionLog.create.mockResolvedValue(null)
  mocked.toolExecutionLog.createMany.mockResolvedValue({ count: 0 })
}

// ---------------------------------------------------------------------------
// Utility: create a minimal Request object for testing API route handlers
// ---------------------------------------------------------------------------

export function createRequest(
  bodyOrMethod?: unknown | string,
  url?: string,
  body?: unknown,
  headers?: Record<string, string>
): Request {
  // Handle both old signature (method, url, body, headers) and new signature (body)
  let method = 'POST'
  let requestUrl = 'http://test'
  let requestBody: unknown = undefined
  let requestHeaders: Record<string, string> = {}

  if (typeof bodyOrMethod === 'string' && url) {
    // Old signature: createRequest(method, url, body, headers)
    method = bodyOrMethod
    requestUrl = url
    requestBody = body
    requestHeaders = headers || {}
  } else {
    // New signature: createRequest(body)
    requestBody = bodyOrMethod
  }

  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...requestHeaders,
    },
  }

  if (requestBody && method !== 'GET') {
    init.body = JSON.stringify(requestBody)
  }

  return new Request(requestUrl, init)
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
