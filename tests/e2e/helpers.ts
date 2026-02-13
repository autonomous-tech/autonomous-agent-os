import type { APIRequestContext } from '@playwright/test'

export const DEPLOYABLE_CONFIG = {
  mission: {
    description: 'E2E test agent for automated testing',
    tasks: ['Answer test questions', 'Validate E2E flows'],
    exclusions: ['Never reveal test internals'],
    audience: { primary: 'Testers', scope: 'team' },
  },
  identity: {
    name: 'TestBot',
    emoji: 'robot',
    vibe: 'Helpful and efficient',
    tone: 'friendly',
    greeting: 'Hi! I am TestBot, ready for E2E testing.',
  },
  capabilities: {
    tools: [
      { id: 'test_tool', name: 'Test Tool', access: 'read-only', description: 'A test tool' },
    ],
  },
  memory: {
    strategy: 'conversational',
    remember: ['Test context'],
  },
  triggers: {
    triggers: [
      { type: 'message', description: 'Responds to test messages' },
    ],
  },
  guardrails: {
    behavioral: ['Stay on topic'],
    prompt_injection_defense: 'strict',
    resource_limits: {
      max_turns_per_session: 3,
      escalation_threshold: 3,
    },
  },
}

export const DEPLOYABLE_STAGES = {
  mission: { status: 'approved', data: {} },
  identity: { status: 'approved', data: {} },
  capabilities: { status: 'approved', data: {} },
  memory: { status: 'approved', data: {} },
  triggers: { status: 'approved', data: {} },
  guardrails: { status: 'approved', data: {} },
}

export async function createDeployableAgent(
  request: APIRequestContext
): Promise<{ id: string; slug: string }> {
  // Create agent
  const createRes = await request.post('/api/agents', {
    data: {
      name: `E2E TestBot ${Date.now()}`,
      description: 'E2E test agent',
    },
  })

  if (!createRes.ok()) {
    throw new Error(`Failed to create agent: ${createRes.status()} ${await createRes.text()}`)
  }

  const created = await createRes.json()
  const id = created.id
  const slug = created.slug

  // Patch with deployable config and stages
  const patchRes = await request.patch(`/api/agents/${id}`, {
    data: {
      config: DEPLOYABLE_CONFIG,
      stages: DEPLOYABLE_STAGES,
    },
  })

  if (!patchRes.ok()) {
    throw new Error(`Failed to patch agent: ${patchRes.status()} ${await patchRes.text()}`)
  }

  return { id, slug }
}

export async function deleteAgent(
  request: APIRequestContext,
  id: string
): Promise<void> {
  await request.delete(`/api/agents/${id}`)
}
