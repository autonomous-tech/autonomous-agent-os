// =============================================================================
// Agent OS -- Test Fixtures
// =============================================================================
// Reusable test data aligned with the spec examples (Fixie, Helix, Sage, Scout).
// =============================================================================

import type {
  AgentConfig,
  StageData,
  ChatMessage,
  ChatResponse,
  TestResponse,
  PreviewUpdate,
} from '@/lib/types'

// ---------------------------------------------------------------------------
// Complete, valid agent config (based on the Fixie example from the spec)
// ---------------------------------------------------------------------------

export const sampleAgentConfig: AgentConfig = {
  mission: {
    description: 'Customer support agent for SaaS product troubleshooting and billing',
    tasks: [
      'Answer login and authentication questions',
      'Handle billing inquiries and refund requests',
      'Log bug reports and feature requests',
      'Escalate complex issues to human support',
    ],
    exclusions: [
      'Never process refunds without human approval',
      'Never access or modify user payment information directly',
    ],
    audience: {
      primary: 'End users of the SaaS product',
      scope: 'public',
    },
  },
  identity: {
    name: 'Fixie',
    emoji: 'wrench',
    vibe: 'Friendly, helpful, solution-oriented',
    tone: 'casual-professional',
    greeting: "Hey! I'm Fixie, your support sidekick. What can I help you with?",
  },
  capabilities: {
    tools: [
      {
        id: 'knowledge_base_search',
        name: 'Knowledge Base Search',
        access: 'read-only',
        description: 'Search the product knowledge base for troubleshooting articles',
      },
      {
        id: 'ticket_creation',
        name: 'Ticket Creation',
        access: 'write',
        description: 'Create support tickets for bug reports and feature requests',
      },
      {
        id: 'account_lookup',
        name: 'User Account Lookup',
        access: 'read-only',
        description: 'Look up user account status for login troubleshooting',
      },
    ],
  },
  memory: {
    strategy: 'conversational',
    remember: [
      'Previous conversations with each user',
      'User preferences and account context',
    ],
  },
  triggers: {
    triggers: [
      {
        type: 'message',
        name: 'Chat Support',
        description: 'Responds when a user starts a support chat',
        channels: ['web_chat', 'slack'],
        response_mode: 'always_on',
      },
      {
        type: 'event',
        name: 'New Ticket Handler',
        description: 'Activates when a support ticket is created',
        source: 'ticketing_system',
        action: 'Triage the ticket, add initial response, assign severity',
      },
    ],
  },
  guardrails: {
    behavioral: [
      'Stay on-topic: only discuss support-related matters',
      'Never share one user\'s data with another',
      'Escalate to human support if unsure after 2 attempts',
      'Never promise refunds without human approval',
    ],
    prompt_injection_defense: 'strict',
    resource_limits: {
      max_turns_per_session: 50,
      escalation_threshold: 3,
    },
  },
}

// ---------------------------------------------------------------------------
// Complete stage data for all 6 stages
// ---------------------------------------------------------------------------

export const sampleStageData: StageData = {
  mission: {
    status: 'approved',
    data: {
      description: sampleAgentConfig.mission!.description,
      tasks: sampleAgentConfig.mission!.tasks,
      exclusions: sampleAgentConfig.mission!.exclusions,
      audience: sampleAgentConfig.mission!.audience,
    },
  },
  identity: {
    status: 'approved',
    data: {
      name: sampleAgentConfig.identity!.name,
      emoji: sampleAgentConfig.identity!.emoji,
      vibe: sampleAgentConfig.identity!.vibe,
      tone: sampleAgentConfig.identity!.tone,
      greeting: sampleAgentConfig.identity!.greeting,
    },
  },
  capabilities: {
    status: 'approved',
    data: {
      tools: sampleAgentConfig.capabilities!.tools,
    },
  },
  memory: {
    status: 'approved',
    data: {
      strategy: sampleAgentConfig.memory!.strategy,
      remember: sampleAgentConfig.memory!.remember,
    },
  },
  triggers: {
    status: 'approved',
    data: {
      triggers: sampleAgentConfig.triggers!.triggers,
    },
  },
  guardrails: {
    status: 'approved',
    data: {
      behavioral: sampleAgentConfig.guardrails!.behavioral,
      prompt_injection_defense: sampleAgentConfig.guardrails!.prompt_injection_defense,
      resource_limits: sampleAgentConfig.guardrails!.resource_limits,
    },
  },
}

// ---------------------------------------------------------------------------
// Incomplete config (missing required fields -- for validation tests)
// ---------------------------------------------------------------------------

export const incompleteAgentConfig: AgentConfig = {
  mission: {
    description: '',
    tasks: [],
    exclusions: [],
  },
  identity: {
    // name is missing
    tone: 'friendly',
  },
  capabilities: {
    tools: [],
  },
  // memory, triggers, guardrails are all missing
}

// ---------------------------------------------------------------------------
// Sample chat message
// ---------------------------------------------------------------------------

export const sampleChatMessage: ChatMessage = {
  role: 'user',
  content: 'I want a customer support agent for my SaaS product',
}

// ---------------------------------------------------------------------------
// Sample chat API response
// ---------------------------------------------------------------------------

export const sampleChatResponse: ChatResponse = {
  reply:
    "Great! Based on what you described, I see a customer support agent that handles troubleshooting and billing questions. I've drafted a starting point -- check the preview on the right. Is this scope right, or does your agent need to handle other topics too?",
  previewUpdates: [
    { field: 'description', value: 'Customer support agent for SaaS product' },
    {
      field: 'tasks',
      value: [
        'Answer product questions',
        'Handle billing inquiries',
        'Escalate complex issues',
      ],
    },
  ] as PreviewUpdate[],
  quickReplies: [
    "That's right",
    'It also needs to handle onboarding',
    'Start over',
  ],
  stageStatus: 'draft',
}

// ---------------------------------------------------------------------------
// Sample test sandbox response
// ---------------------------------------------------------------------------

export const sampleTestResponse: TestResponse = {
  role: 'agent',
  content:
    "Oh no, let's get you sorted! Can you tell me the email address you used to sign up? I'll check what's going on with your account.",
  metadata: {
    capabilitiesUsed: ['account_lookup'],
    guardrailsActive: ['no_data_sharing', 'escalation_after_2_attempts'],
    tone: 'friendly',
  },
}

// ---------------------------------------------------------------------------
// Sample database rows
// ---------------------------------------------------------------------------

export function createMockAgentProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'clx1abc2def',
    name: 'Fixie',
    slug: 'fixie',
    description: 'Customer support agent for SaaS product',
    status: 'draft',
    config: JSON.stringify(sampleAgentConfig),
    stages: JSON.stringify(sampleStageData),
    conversations: JSON.stringify({
      mission: [],
      identity: [],
      capabilities: [],
      memory: [],
      triggers: [],
      guardrails: [],
    }),
    templateId: null,
    createdAt: new Date('2026-02-10T12:00:00.000Z'),
    updatedAt: new Date('2026-02-10T12:00:00.000Z'),
    exportedAt: null,
    ...overrides,
  }
}

export function createMockTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tpl_support',
    name: 'Customer Support Agent',
    description: 'Answers FAQs, logs issues, escalates to humans',
    category: 'customer_support',
    config: JSON.stringify(sampleAgentConfig),
    stages: JSON.stringify(sampleStageData),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// All 3 default templates from the spec
// ---------------------------------------------------------------------------

export const defaultTemplates = [
  createMockTemplate({
    id: 'tpl_support',
    name: 'Customer Support Agent',
    description: 'Answers FAQs, logs issues, escalates to humans',
    category: 'customer_support',
  }),
  createMockTemplate({
    id: 'tpl_research',
    name: 'Research Assistant',
    description: 'Monitors topics, summarizes findings, maintains knowledge',
    category: 'research',
  }),
  createMockTemplate({
    id: 'tpl_sales',
    name: 'Sales Support Agent',
    description: 'Drafts outreach, researches prospects, prepares for calls',
    category: 'sales',
  }),
]

// ---------------------------------------------------------------------------
// Second agent (Helix -- Research Assistant) for multi-agent list tests
// ---------------------------------------------------------------------------

export const helixAgentConfig: AgentConfig = {
  mission: {
    description: 'Research assistant that monitors topics and summarizes findings',
    tasks: [
      'Monitor news and research papers on specified topics',
      'Summarize findings into daily briefs',
      'Maintain a knowledge base of key insights',
    ],
    exclusions: ['Do not make investment recommendations'],
    audience: { primary: 'Research team', scope: 'team' },
  },
  identity: {
    name: 'Helix',
    emoji: 'microscope',
    vibe: 'Analytical, thorough, and curious',
    tone: 'professional',
    greeting: "Hello! I'm Helix, your research companion. What topic shall we explore?",
  },
  capabilities: {
    tools: [
      {
        id: 'web_search',
        name: 'Web Search',
        access: 'read-only',
        description: 'Search the web for recent articles and papers',
      },
    ],
  },
  memory: {
    strategy: 'task-based',
    remember: ['Research topics', 'Key findings'],
  },
  triggers: {
    triggers: [
      { type: 'schedule', description: 'Runs daily research scan at 8 AM' },
    ],
  },
  guardrails: {
    behavioral: ['Only discuss research-related topics', 'Cite sources for all claims'],
    prompt_injection_defense: 'strict',
    resource_limits: { max_turns_per_session: 30 },
  },
}

export function createMockHelixProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'clx2helix456',
    name: 'Helix',
    slug: 'helix',
    description: 'Research assistant that monitors topics and summarizes findings',
    status: 'building',
    config: JSON.stringify(helixAgentConfig),
    stages: JSON.stringify({
      mission: { status: 'approved', data: {} },
      identity: { status: 'approved', data: {} },
      capabilities: { status: 'draft', data: {} },
      memory: { status: 'incomplete', data: {} },
      triggers: { status: 'incomplete', data: {} },
      guardrails: { status: 'incomplete', data: {} },
    }),
    conversations: JSON.stringify({
      mission: [],
      identity: [],
      capabilities: [],
      memory: [],
      triggers: [],
      guardrails: [],
    }),
    templateId: null,
    createdAt: new Date('2026-02-10T14:00:00.000Z'),
    updatedAt: new Date('2026-02-10T14:00:00.000Z'),
    exportedAt: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock Deployment factory
// ---------------------------------------------------------------------------

export function createMockDeployment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dep_abc123',
    agentId: 'clx1abc2def',
    version: 1,
    config: JSON.stringify(sampleAgentConfig),
    systemPrompt: 'You are Fixie.\n\nIDENTITY:\n- Name: Fixie\n- Tone: casual-professional',
    status: 'active',
    createdAt: new Date('2026-02-10T12:30:00.000Z'),
    updatedAt: new Date('2026-02-10T12:30:00.000Z'),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock ChatSession factory
// ---------------------------------------------------------------------------

export function createMockChatSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ses_abc123',
    deploymentId: 'dep_abc123',
    token: 'ses_testtoken_abcdef12',
    messages: '[]',
    turnCount: 0,
    failedAttempts: 0,
    status: 'active',
    metadata: '{}',
    createdAt: new Date('2026-02-10T13:00:00.000Z'),
    updatedAt: new Date('2026-02-10T13:00:00.000Z'),
    ...overrides,
  }
}
