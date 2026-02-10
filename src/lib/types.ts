// ── Stage definitions ──────────────────────────────────────────────

export const STAGES = [
  "mission",
  "identity",
  "capabilities",
  "memory",
  "triggers",
  "guardrails",
] as const;

export type StageName = (typeof STAGES)[number];

export type StageStatus = "incomplete" | "draft" | "approved";

// ── Agent config (the aggregated JSON stored in `config` column) ──

export interface MissionConfig {
  description?: string;
  tasks?: string[];
  exclusions?: string[];
  audience?: {
    primary?: string;
    scope?: "owner-only" | "team" | "public";
  };
}

export interface IdentityConfig {
  name?: string;
  emoji?: string;
  vibe?: string;
  tone?: string;
  greeting?: string;
}

export interface Capability {
  id?: string;
  name: string;
  access: "read-only" | "write" | "full";
  description: string;
}

export interface Skill {
  id?: string;
  name: string;
  description: string;
  when_to_use?: string;
  steps?: string[];
  constraints?: string[];
}

export interface CapabilitiesConfig {
  tools?: Capability[];
  skills?: Skill[];
}

export interface MemoryConfig {
  strategy?: "conversational" | "task-based" | "minimal";
  remember?: string[];
  daily_logs?: boolean;
  curated_memory?: boolean;
  max_memory_size?: string;
}

export interface Trigger {
  type: "message" | "event" | "schedule";
  name?: string;
  description: string;
  channels?: string[];
  source?: string;
  response_mode?: string;
  action?: string;
}

export interface TriggersConfig {
  triggers?: Trigger[];
}

export interface GuardrailsConfig {
  behavioral?: string[];
  prompt_injection_defense?: "strict" | "moderate" | "none";
  resource_limits?: {
    max_turns_per_session?: number;
    escalation_threshold?: number;
    max_response_length?: number;
  };
}

export interface AgentConfig {
  mission?: MissionConfig;
  identity?: IdentityConfig;
  capabilities?: CapabilitiesConfig;
  memory?: MemoryConfig;
  triggers?: TriggersConfig;
  guardrails?: GuardrailsConfig;
}

// ── Stage data (the JSON stored in `stages` column) ───────────────

export interface StageEntry {
  status: StageStatus;
  data: Record<string, unknown>;
}

export type StageData = Record<StageName, StageEntry>;

// ── Conversations (the JSON stored in `conversations` column) ─────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type ConversationData = Record<StageName, ChatMessage[]>;

// ── API types ─────────────────────────────────────────────────────

export interface PreviewUpdate {
  field: string;
  value: unknown;
}

export interface ChatResponse {
  reply: string;
  previewUpdates: PreviewUpdate[];
  quickReplies: string[];
  stageStatus: StageStatus;
}

export interface TestResponse {
  role: "agent";
  content: string;
  metadata: {
    capabilitiesUsed: string[];
    guardrailsActive: string[];
    tone: string;
  };
}

export interface ValidationError {
  level: "structural" | "completeness" | "consistency";
  message: string;
  fix?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ── Config accessors (handle both nested and flat shapes) ────────

/**
 * Extract tools array from config, handling both shapes:
 * - { tools: [...] } (our AgentConfig type)
 * - [...] (flat array from templates)
 */
export function getTools(config: AgentConfig): Capability[] {
  const caps = config.capabilities;
  if (!caps) return [];
  if (Array.isArray(caps)) return caps as unknown as Capability[];
  return caps.tools || [];
}

/**
 * Extract triggers array from config, handling both shapes:
 * - { triggers: [...] } (our AgentConfig type)
 * - [...] (flat array from templates)
 */
export function getTriggers(config: AgentConfig): Trigger[] {
  const trigs = config.triggers;
  if (!trigs) return [];
  if (Array.isArray(trigs)) return trigs as unknown as Trigger[];
  return trigs.triggers || [];
}

// ── Default stage data ────────────────────────────────────────────

export function defaultStageData(): StageData {
  return {
    mission: { status: "incomplete", data: {} },
    identity: { status: "incomplete", data: {} },
    capabilities: { status: "incomplete", data: {} },
    memory: { status: "incomplete", data: {} },
    triggers: { status: "incomplete", data: {} },
    guardrails: { status: "incomplete", data: {} },
  };
}

export function defaultConversations(): ConversationData {
  return {
    mission: [],
    identity: [],
    capabilities: [],
    memory: [],
    triggers: [],
    guardrails: [],
  };
}
