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

export interface CapabilitiesConfig {
  tools?: Capability[];
}

export interface MemoryConfig {
  strategy?: "conversational" | "task-based" | "minimal";
  remember?: string[];
}

export interface Trigger {
  id?: string;
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
    max_tool_calls_per_session?: number;
    max_tool_calls_per_hour?: number;
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

// ── AI Enrichment types ──────────────────────────────────────────

export interface EnrichmentSuggestion {
  field: string;
  original: string;
  improved: string;
  reason: string;
}

export interface EnrichmentIdea {
  type: "task" | "capability" | "trigger" | "guardrail" | "remember";
  value: string | Record<string, unknown>;
  reason: string;
}

export interface EnrichmentQuestion {
  question: string;
  options: string[];
  affects: string[];
  reason: string;
}

export interface EnrichmentResponse {
  suggestions: EnrichmentSuggestion[];
  ideas: EnrichmentIdea[];
  questions: EnrichmentQuestion[];
}

export type AiCalloutType = "suggestion" | "idea" | "question";

export interface AiCallout {
  id: string;
  type: AiCalloutType;
  data: EnrichmentSuggestion | EnrichmentIdea | EnrichmentQuestion;
}

export interface CalloutHandlers {
  callouts?: AiCallout[];
  onAcceptCallout?: (id: string) => void;
  onDismissCallout?: (id: string) => void;
  onAnswerCallout?: (id: string, answer: string) => void;
  enriching?: boolean;
}

export type CardStatus = "empty" | "draft" | "done";

// ── Section names (map to AGENT-MD-SPEC sections) ────────────────

export const SECTION_NAMES = [
  "identity",
  "purpose",
  "audience",
  "workflow",
  "memory",
  "boundaries",
] as const;

export type SectionName = (typeof SECTION_NAMES)[number];

// ── Structured creation input (new multi-step flow) ──────────────

export interface CreateAgentInput {
  archetype: string;
  audience: "owner-only" | "team" | "public";
  name: string;
  emoji?: string;
  context?: string; // optional free-text from "anything specific?" textarea
  customDescription?: string; // only when archetype === "custom"
}
