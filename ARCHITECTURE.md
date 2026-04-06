# ARCHITECTURE.md

How Agent OS thinks, how data flows, why decisions were made, and how to safely change things.

For operational reference (commands, API listings, env vars, gotchas), see [CLAUDE.md](./CLAUDE.md).

---

## 1. System Concept Map

```
┌─────────────────────────────────────────────────────────────────┐
│  BUILDER LAYER                                                  │
│  Conversational 6-stage agent creation flow                     │
│  /api/chat  ·  /api/agents  ·  /api/agents/[id]/stages/[stage] │
├─────────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                     │
│  11 Prisma models in SQLite · JSON strings at column boundary   │
│  AgentProject · Deployment · ChatSession · McpServerConfig ...  │
├─────────────────────────────────────────────────────────────────┤
│  RUNTIME LAYER                                                  │
│  Two engines: Claude (stateless) and Letta (stateful memory)    │
│  /api/runtime/[slug]/chat  ·  MCP tool execution pipeline       │
├─────────────────────────────────────────────────────────────────┤
│  PRESENTATION LAYER                                             │
│  Next.js App Router · 3-pane workspace · 3 Zustand stores       │
│  Dashboard · Builder · Workspace · Teams · Public agent page    │
└─────────────────────────────────────────────────────────────────┘
```

**Builder Layer** — Collects agent configuration through guided conversation. Outputs a structured `AgentConfig` JSON object. Has no knowledge of runtime behavior.

**Data Layer** — Prisma + SQLite. All complex objects (config, stages, conversations, MCP settings) are JSON-serialized `String` columns. Parsing happens at the API boundary, never inside library functions.

**Runtime Layer** — Takes a frozen deployment snapshot (config + system prompt + MCP config) and serves chat. Routes to either the Claude engine or the Letta engine based on presence of `lettaAgentId`.

**Presentation Layer** — React 19 with Zustand for UI state and TanStack Query for server state. Three stores (workspace, chat, memory) are kept strictly separate.

---

## 2. Two Runtimes: Claude Engine vs. Letta Engine

The central architectural concept. Every runtime chat request arrives at the same endpoint but follows one of two completely different paths.

### Entry Point

`src/app/api/runtime/[slug]/chat/route.ts` — POST handler.

### Branching Condition (line 34)

```
if (agent.lettaAgentId && isLettaEnabled() && lettaClient)
```

All three must be truthy. If any is falsy, the request falls through to the Claude engine path.

### Path A: Letta Engine

```
POST /api/runtime/[slug]/chat
  → Look up AgentProject by slug
  → Check: lettaAgentId && isLettaEnabled() && lettaClient  ← YES
  → lettaClient.agents.messages.create(lettaAgentId, { messages })
  → Extract last assistant message from Letta response array
  → Return { message, session: { token: "letta", ... } }
```

Letta manages its own session state, memory, and recall. The response is a flat message — no tool execution logs surface to the caller. Session token is always the literal string `"letta"`.

### Path B: Claude Engine

```
POST /api/runtime/[slug]/chat
  → Look up AgentProject by slug
  → Check: lettaAgentId && isLettaEnabled() && lettaClient  ← NO
  → Look up active Deployment for this agent
  → Parse frozen config and mcpConfig from Deployment row
  → Find or create ChatSession (session token in body or cookie)
  → Parse message history from session.messages (JSON string)
  → processMessage(systemPrompt, config, sessionStatus, ...)
      → checkPreMessage() — guardrail gate
      → If MCP servers present:
          → McpClientManager.connect() → listTools() → toAnthropicTools()
          → Agentic loop (up to 10 iterations):
              → chatWithTools() → if stop_reason === "tool_use":
                  → parseToolName() → executeTool() → feed results back
              → else: extract text → return
          → McpClientManager.disconnect() (always, in finally)
      → If no MCP servers:
          → chat() with capped history (40 messages)
  → Persist updated messages + session state to ChatSession
  → Log tool executions to ToolExecutionLog
  → Set session cookie for new sessions (7-day expiry)
  → Return { message, session, toolsUsed?, guardrailNotice? }
```

### Path C: Builder Chat (distinct from both)

`/api/chat` — Used during the 6-stage builder flow. This is NOT a runtime path.

- Uses `BASE_SYSTEM_PROMPT` + `STAGE_PROMPTS[stage]` (builder persona)
- Returns `ChatResponse` with `{ reply, previewUpdates, quickReplies, stageStatus }`
- `previewUpdates` trigger live config panel updates in the UI
- Conversation history is per-stage, capped at 40 messages (20 turns)

**Key distinction:** Builder chat outputs structured JSON with `previewUpdates`. Runtime chat outputs a plain text message. Confusing these two prompt contexts causes bugs.

---

## 3. Entity Lifecycles

### AgentProject

```
draft ──→ building ──→ deployed
  │          │
  │          └── Set on first POST /api/chat interaction
  └── Initial state after POST /api/agents
```

- `draft` → `building`: First builder chat interaction (`/api/chat` route sets this)
- `building` → `deployed`: `POST /api/agents/[id]/deploy` sets this after creating a Deployment row

### Deployment

```
                 ┌─── paused ←──┐
                 │    (DELETE)   │ (PATCH)
                 ↓              │
(created) → active ─────────────┘
              │
              └──→ retired  (when a new deploy replaces this one)
```

- Created by `POST /api/agents/[id]/deploy` with status `active`
- `active` → `paused`: `DELETE /api/agents/[id]/deploy`
- `paused` → `active`: `PATCH /api/agents/[id]/deploy`
- `active` → `retired`: Automatically when a new deployment is created (line 43-48 of deploy route)

**Immutability invariant:** A Deployment row's `config`, `systemPrompt`, and `mcpConfig` are frozen snapshots. They never change after creation. New config = new Deployment.

### ChatSession

```
active ──→ ended       (max turns reached)
  │
  └──→ escalated   (failed attempts >= threshold)
```

- `active` → `ended`: When `turnCount >= maxTurns` (checked in `processMessage`, engine.ts line 95)
- `active` → `escalated`: When `failedAttempts >= escalationThreshold` (checked in `checkPostMessage`)
- Once ended or escalated, `checkPreMessage()` blocks further messages

### Stage (within AgentProject)

```
incomplete ──→ draft ──→ approved
```

- `incomplete`: Initial state for all 6 stages
- `draft`: Builder has collected some data but user hasn't confirmed
- `approved`: User has approved this stage's configuration

The stage status lives inside the `stages` JSON column as `StageData[stageName].status`.

---

## 4. End-to-End Flow: Description to Deployed Agent

### Step 1: Creation

```
POST /api/agents  { description: "A customer support agent for..." }
  → inferFromDescription(description)         // src/lib/claude.ts
  → Claude generates initial AgentConfig JSON
  → Strip markdown fences, JSON.parse (with fallback)
  → generateSlug(name) + "-" + Date.now().toString(36)
  → prisma.agentProject.create({ config: JSON.stringify(...), stages: JSON.stringify(defaultStageData()) })
```

**Output:** AgentProject row with status `draft`, full initial config, all 6 stages `incomplete`.

### Step 2: Building (6-stage conversation)

```
POST /api/chat  { message, stage, projectId }
  → Load agent, parse config/stages/conversations
  → Build system prompt: BASE_SYSTEM_PROMPT + STAGE_PROMPTS[stage] + dynamic context
  → Inject valid field names for this stage into prompt
  → chat(systemPrompt, stageHistory)
  → Parse Claude response as ChatResponse { reply, previewUpdates, stageStatus }
  → Merge previewUpdates into config (partial merge, not replace)
  → Update stage status if changed
  → Cap conversation at 40 messages
  → Persist config + stages + conversations
```

Repeat for each stage: Mission → Identity → Capabilities → Memory → Triggers → Guardrails.

### Step 3: Validation

```
validateAgent(config, stages)                 // src/lib/export.ts
  → Structural errors (block deployment): missing name, mission, tasks
  → Completeness warnings (non-blocking): missing tone, guardrails, triggers
  → Consistency warnings: incomplete stages
  → Return { valid: boolean, errors, warnings }
```

### Step 4: Deployment

```
POST /api/agents/[id]/deploy
  → validateAgent() — structural errors block deployment
  → Retire existing active deployments → status: "retired"
  → Calculate version = max(existing versions) + 1
  → buildRuntimeSystemPrompt(config)          // src/lib/runtime/prompt.ts
  → Snapshot MCP configs: prisma.mcpServerConfig.findMany → JSON.stringify
  → prisma.deployment.create({ config, systemPrompt, mcpConfig, version })
  → agentProject.status = "deployed"
  → Side-deploy to Letta (if enabled, non-blocking try/catch):
      → translateToLettaParams() + buildMemoryCategorizationPrompt()
      → lettaClient.agents.create()
      → loadSkillsDirectory() (skills/ → archival memory chunks)
      → Save lettaAgentId to AgentProject
```

### Step 5: Runtime Chat

See Section 2 for the full trace.

### Blast Radius of AgentConfig Shape Changes

If you modify the `AgentConfig` interface in `src/lib/types.ts`:

| Affected | Why |
|----------|-----|
| `src/lib/runtime/prompt.ts` | `buildRuntimeSystemPrompt()` reads config fields |
| `src/lib/letta/translate.ts` | `translateToLettaParams()` maps config to Letta params |
| `src/lib/export.ts` | `validateAgent()` + all `generate*()` functions read config |
| `src/lib/prompts/index.ts` | Stage prompts reference config field names |
| `src/app/api/chat/route.ts` | Injects valid field names for `previewUpdates` |
| All test files in `tests/` | Test factories create mock configs |
| Existing deployments | Frozen `config` JSON won't have new fields |

---

## 5. Memory Architecture

Three tiers, each with different scope and persistence.

### Tier 1: Global (per agent)

Lives in Letta's database, attached to a single agent. Survives across projects and sessions.

| Block | Content | Limit | Mutable |
|-------|---------|-------|---------|
| `persona` | Identity + mission + behavioral rules | 5000 chars | Yes |
| `scratchpad` | Working notes, current task context | 5000 chars | Yes |
| `memory_instructions` | User preferences to remember | 3000 chars | Read-only |
| Archival memory | Skill chunks, craft knowledge | Unlimited | Append-only |

Built by `translateToLettaParams()` in `src/lib/letta/translate.ts`. The persona block is assembled from `identity.name`, `identity.vibe`, `identity.tone`, `mission.description`, `mission.tasks`, `mission.exclusions`, and `guardrails.behavioral`.

### Tier 2: Project (shared across team)

Four Letta blocks created by `createSharedProjectBlocks()` in `src/lib/letta/memory.ts`. Attached to all team members working on the same project.

| Block | Purpose | Limit | Mutable |
|-------|---------|-------|---------|
| `project` | Project name, brief, goals | 2000 chars | Read-only |
| `decisions` | Key decisions, requirements, constraints | 8000 chars | Yes |
| `task_board` | Current sprint tasks, blockers | 6000 chars | Yes |
| `brand` | Brand guide, voice, design tokens | 10000 chars | Read-only |

Block IDs are stored in `TeamProject.lettaBlockIds` as a JSON string. The blocks themselves live in Letta's database (Docker + Postgres), not in SQLite.

### Tier 3: Session (per conversation)

- **Letta engine:** Letta's built-in recall memory. Automatically managed.
- **Claude engine:** `ChatSession.messages` column — JSON array of `RuntimeMessage[]`. Capped at 40 messages by `buildMessages()` in `engine.ts`.

### Memory Self-Categorization

`buildMemoryCategorizationPrompt()` in `src/lib/letta/translate.ts` appends instructions to the Letta agent's system prompt teaching it to sort new learnings:

- Project-specific facts → shared `decisions` block (via `core_memory_replace`)
- User preferences → agent's `persona` block (via `core_memory_replace`)
- Craft knowledge → archival memory (via `archival_memory_insert`)

### Skills → Archival Memory

SKILL.md files in `skills/` are loaded at deploy time by `loadSkillsDirectory()`. Each file is:
1. Read from disk
2. Split into ~1000 char chunks at paragraph boundaries
3. Tagged with `[SKILL: skillName]` header and `["skillName", "skill"]` tags
4. Inserted into Letta archival memory via `lettaClient.agents.passages.create()`

---

## 6. MCP Tool Execution Pipeline

End-to-end trace from tool definition to execution result.

### 1. Definition

MCP servers are configured per-agent via `McpServerConfig` Prisma model. Each row specifies transport (stdio/sse/http), command/URL, allowed/blocked tool patterns, and sandbox config.

### 2. Snapshotting (at deploy time)

```
// src/app/api/agents/[id]/deploy/route.ts line 61-64
const activeMcpServers = await prisma.mcpServerConfig.findMany({
  where: { agentId: id, status: "active" },
});
const mcpConfig = JSON.stringify(activeMcpServers.map(rowToDefinition));
```

MCP config is frozen into the Deployment row. Runtime uses the snapshot, not live config.

### 3. Connection

`McpClientManager.connect()` (`src/lib/runtime/mcp-client.ts`):
- Filters out servers with `status: "inactive"`
- Creates MCP `Client` per server with appropriate transport (StdioClientTransport, SSEClientTransport, or StreamableHTTPClientTransport)
- Uses `Promise.allSettled()` — failed connections log warnings but don't abort the batch

### 4. Tool Enumeration

`McpClientManager.listTools()`:
- Queries each connected server via `client.listTools()`
- Applies per-server `allowedTools` / `blockedTools` glob filters (`matchesGlob()`)
- Results are cached for the lifetime of the connection

### 5. Anthropic Format Conversion

`McpClientManager.toAnthropicTools()`:
- Tool names are namespaced as `${serverName}__${toolName}` to prevent collisions
- Schema is mapped to Anthropic's `{ name, description, input_schema }` format

### 6. Agentic Loop

`processWithTools()` in `src/lib/runtime/engine.ts`:

```
for iteration in 0..10:
    response = chatWithTools(systemPrompt, messages, tools)
    if stop_reason !== "tool_use":
        return extractText(response)
    for each tool_use block:
        parse "serverName__toolName" → { serverName, toolName }
        result = mcpClient.executeTool(toolCall)
        record in allToolExecutions
    append tool results as user message
if max iterations: one final call WITHOUT tools to force text response
```

### 7. Execution with Timeout

`McpClientManager.executeTool()`:
- Resolves server from namespaced tool name
- Enforces timeout via `AbortController` + `Promise.race` (default 30s)
- Truncates output at `maxOutputSize` (default 100KB)
- Returns `{ toolCallId, output, isError, durationMs }`

### 8. Logging

Tool executions are persisted to `ToolExecutionLog` table after `processMessage()` returns (runtime chat route, lines 164-177).

### 9. Cleanup

`McpClientManager.disconnect()` is called in a `finally` block. Closes all MCP client connections (especially important for stdio processes).

### Security Boundaries

- **Tool filtering:** `allowedTools` / `blockedTools` glob patterns per server
- **Timeout enforcement:** Per-server `sandbox.maxExecutionMs` (default 30s)
- **Output truncation:** `sandbox.maxOutputSize` (default 100KB)
- **Transport isolation:** Each server gets its own `Client` instance

---

## 7. Prompt Architecture

Three distinct prompt contexts exist in the system. Confusing them causes bugs because each expects a different persona and response format.

### Context 1: Builder

**Used in:** `POST /api/chat` (builder conversation)
**Prompt source:** `src/lib/prompts/index.ts`

```
BASE_SYSTEM_PROMPT + "\n\n" + STAGE_PROMPTS[currentStage] + "\n\n" + dynamicContext
```

- `BASE_SYSTEM_PROMPT` — Builder persona ("You are the Agent OS builder..."). Contains `{DYNAMIC}` placeholder replaced with current project config.
- `STAGE_PROMPTS[stage]` — Stage-specific collection goals (e.g., mission needs description + tasks + exclusions + audience)
- `COMPLETION_CRITERIA[stage]` — What must be true before marking stage "approved"

**Response format:** `ChatResponse { reply, previewUpdates[], quickReplies[], stageStatus }`

### Context 2: Test Sandbox

**Used in:** `POST /api/test`
**Prompt source:** `TEST_SYSTEM_PROMPT` in `src/lib/prompts/index.ts`

```
TEST_SYSTEM_PROMPT with {CONFIG} replaced by serialized AgentConfig
```

Claude role-plays AS the agent being built (NOT as the builder). Follows the agent's tone, capabilities, and guardrails. Used for "Try It" preview.

**Response format:** `TestResponse { role: "agent", content, metadata }`

### Context 3: Runtime

**Used in:** `POST /api/runtime/[slug]/chat` (Claude engine path)
**Prompt source:** `buildRuntimeSystemPrompt()` in `src/lib/runtime/prompt.ts`

```
Sections: IDENTITY → MISSION → CAPABILITIES → GUARDRAILS → SECURITY → RULES
```

Assembled from `AgentConfig` fields. This is the deployed agent's persona. Frozen into the `Deployment.systemPrompt` column at deploy time.

**Response format:** Plain text (or text + tool_use blocks if MCP tools are present)

### Template Shape Mismatch

Templates store `capabilities` and `triggers` as flat arrays. `AgentConfig` uses nested objects (`{ tools: [...] }` and `{ triggers: [...] }`). The bridge functions `getTools()` and `getTriggers()` in `src/lib/types.ts` handle both shapes — always use them instead of accessing these fields directly.

---

## 8. Data Serialization: The JSON Boundary

SQLite has no native JSON type. All complex data is stored as JSON strings in `String` columns. The invariant: **`JSON.parse()` at API boundary; library functions receive parsed objects.**

| Column | Model | TypeScript Type | Parse Location |
|--------|-------|-----------------|----------------|
| `config` | AgentProject | `AgentConfig` | API route handlers |
| `stages` | AgentProject | `StageData` | API route handlers |
| `conversations` | AgentProject | `ConversationData` | `/api/chat` route |
| `config` | Deployment | `AgentConfig` | Runtime chat route |
| `systemPrompt` | Deployment | `string` (plain) | N/A (not JSON) |
| `mcpConfig` | Deployment | `McpServerDefinition[]` | Runtime chat route |
| `messages` | ChatSession | `RuntimeMessage[]` | Runtime chat route |
| `metadata` | ChatSession | `Record<string, unknown>` | Runtime chat route |
| `args` | McpServerConfig | `string[]` | `rowToDefinition()` helper |
| `env` | McpServerConfig | `Record<string, string>` | `rowToDefinition()` helper |
| `allowedTools` | McpServerConfig | `string[]` | `rowToDefinition()` helper |
| `blockedTools` | McpServerConfig | `string[]` | `rowToDefinition()` helper |
| `sandboxConfig` | McpServerConfig | `SandboxConfig` | `rowToDefinition()` helper |
| `orchestrationConfig` | AgentTeam | `object` | Team API routes |
| `lettaBlockIds` | TeamProject | `SharedBlockIds` | Team deploy route |
| `activityLog` | TeamProject | `ActivityEntry[]` | Team API routes |
| `metadata` | Task, Artifact | `Record<string, unknown>` | Task/Artifact routes |
| `config` | AgentTemplate | `AgentConfig` (template shape) | Agent creation |
| `stages` | AgentTemplate | `StageData` | Agent creation |

**Rule:** If you're writing a library function (in `src/lib/`), expect parsed objects. If you're writing a route handler (in `src/app/api/`), you're responsible for `JSON.parse()` on input and `JSON.stringify()` on output.

---

## 9. Frontend State Architecture

### Three Stores, Three Concerns

| Store | File | Concern | Example State |
|-------|------|---------|---------------|
| Workspace | `src/stores/workspace-store.ts` | Navigation + layout | `activeAgentId`, `activeTab`, `rightPanelOpen` |
| Chat | `src/stores/chat-store.ts` | Messages + streaming | `messages[]`, `isStreaming`, `partialContent` |
| Memory | `src/stores/memory-store.ts` | Block inspection + editing | `blocks[]`, `activeBlockLabel`, `editDraft` |

### Data Fetching Pattern

- **TanStack Query** — Server state (agent data, deployments, team lists). Cached, refetched, invalidated.
- **Zustand** — UI state only (which tab is active, streaming progress, edit drafts). Never stores server data.
- These two are never mixed. Zustand stores don't fetch from the API. TanStack Query doesn't manage UI toggles.

### Streaming Lifecycle (Chat Store)

```
User sends message
  → addUserMessage(content)         // Add to messages[]
  → startStreaming()                // isStreaming=true, partialContent=""
  → appendStreamContent(chunk)     // partialContent accumulates
  → addToolCall(...)               // Optional: tool use blocks appear
  → resolveToolCall(id, result)    // Optional: tool results arrive
  → addMemoryUpdate(label, action) // Optional: memory changes
  → finishStreaming(messageId)     // Commit partialContent → messages[]
```

If an error occurs at any point: `setError(message)` resets `isStreaming` to false.

---

## 10. Architecture Decision Records

### ADR-1: SQLite over Postgres

**Context:** Agent OS needs a database. It's a single-user development tool, not a multi-tenant SaaS.

**Decision:** SQLite via Prisma's `@prisma/adapter-better-sqlite3`. Single file, zero ops, instant setup.

**Consequence:** No native JSON columns — all complex data stored as JSON strings (see Section 8). No concurrent write scaling. Acceptable for the current use case; migration to Postgres requires changing the Prisma datasource provider and updating JSON column handling.

### ADR-2: Letta as Optional Integration

**Context:** Letta provides persistent memory and self-editing capabilities, but requires Docker (Letta server + Postgres). Not all developers want to run Docker for local development.

**Decision:** All Letta functions guard with `isLettaEnabled()`. The `lettaClient` singleton is nullable — returns null if `LETTA_BASE_URL` is unset. The app runs fully without Letta; agents fall back to the Claude engine.

**Consequence:** Every Letta call site needs `if (isLettaEnabled() && lettaClient)` or `ensureLettaAvailable()`. Letta modules must be mocked per-test-file (not globally) because they're optional. The `lettaClient!` non-null assertion is safe only after the guard.

### ADR-3: Config Snapshotting at Deploy Time

**Context:** An agent's config can change after deployment (user continues building). Should runtime use live config or a frozen snapshot?

**Decision:** Freeze everything at deploy time. `Deployment` stores frozen `config` (JSON string), pre-built `systemPrompt`, and frozen `mcpConfig`. Runtime reads only from the Deployment row.

**Consequence:** Editing an agent's config does NOT affect the running deployment. You must redeploy to apply changes. This makes deployments immutable and reproducible. Old deployments can be inspected to see exactly what was running.

### ADR-4: Namespaced MCP Tool Names

**Context:** Multiple MCP servers may expose tools with the same name (e.g., two servers both have a `read` tool).

**Decision:** Tool names are prefixed as `${serverName}__${toolName}` when sent to Claude. The engine parses this back when executing.

**Consequence:** Claude sees globally unique tool names. The `parseToolName()` function in `engine.ts` and `resolveServerForTool()` in `mcp-client.ts` handle the split. Tool names in logs use the unprefixed name + separate `serverName` field.

### ADR-5: Conversation History Capping

**Context:** Builder conversations and runtime sessions can grow unboundedly, increasing token costs and latency.

**Decision:** Cap at 40 messages (20 user-assistant turns) in both builder chat and runtime engine. Builder caps per-stage; runtime caps the session history passed to Claude.

**Consequence:** Very long conversations lose early context. The cap is applied by `buildMessages()` via `.slice(-MAX_HISTORY_MESSAGES)`. This is a simple sliding window — no summarization. Letta agents are unaffected (Letta manages its own recall).

### ADR-6: Non-blocking Letta Side-Deploy

**Context:** When deploying an agent, we also want to create a Letta agent for the persistent-memory path. But Letta might be down or misconfigured.

**Decision:** The Letta side-deploy in `POST /api/agents/[id]/deploy` is wrapped in `try/catch` (deploy route lines 86-123). Failure logs a warning but does not fail the deployment.

**Consequence:** An agent can be deployed (Claude engine works) even if Letta is unavailable. The `lettaAgentId` will be null, and runtime chat will use the Claude path. If Letta comes back later, a redeploy will attempt the side-deploy again.

---

## 11. Change Impact Map

| If you change... | Also affected | Must test |
|---|---|---|
| `AgentConfig` interface (`src/lib/types.ts`) | `buildRuntimeSystemPrompt`, `translateToLettaParams`, `validateAgent`, all export generators, builder field names in `/api/chat`, test factories | Unit tests for prompt, translate, export; integration deploy+chat flow |
| `buildRuntimeSystemPrompt` (`src/lib/runtime/prompt.ts`) | All runtime chat behavior, existing deployments (they're frozen, won't get the new prompt) | Runtime chat tests, manual chat verification |
| `processMessage` (`src/lib/runtime/engine.ts`) | Runtime chat response format, session state transitions, tool execution behavior | `tests/runtime/engine.test.ts`, `tests/flows/deploy-chat.test.ts` |
| `McpClientManager` (`src/lib/runtime/mcp-client.ts`) | Tool execution, timeout behavior, connection lifecycle | `tests/runtime/mcp-client.test.ts`, `tests/runtime/mcp-presets.test.ts` |
| Prisma schema (`prisma/schema.prisma`) | All API routes that read/write affected models, test helpers, seed scripts | Run `npx prisma migrate dev`, all API tests, all flow tests |
| Stage names (`STAGES` in `src/lib/types.ts`) | `STAGE_PROMPTS`, `COMPLETION_CRITERIA`, `defaultStageData()`, `defaultConversations()`, builder UI stage navigation | All builder tests, e2e builder spec |
| Letta client functions (`src/lib/letta/*.ts`) | Team deploy, project memory, skills loading | Per-file Letta mock tests in `tests/lib/letta-*.test.ts` |
| Zustand store shapes (`src/stores/*.ts`) | All components that use the store hooks | Store unit tests in `tests/stores/` |
| Shared block structure (`SharedBlockIds`) | `createSharedProjectBlocks`, `attachSharedBlocks`, `detachSharedBlocks`, team deploy, project memory setup | `tests/lib/letta-memory.test.ts`, `tests/lib/letta-teams.test.ts` |
| Slug generation | URL routing for public agent pages (`/a/[slug]`), uniqueness constraint, MCP server agent resolution | `tests/lib/slug.test.ts` |
| Guardrail types (`GuardrailsConfig`) | `checkPreMessage`, `checkPostMessage`, runtime prompt SECURITY section, export guardrails.md | `tests/runtime/guardrails.test.ts` |
| Claude Code generators (`src/lib/claude-code/`) | Generated subagent `.md` files, `.mcp.json`, hooks, team context | Team export endpoint, agent definition endpoint |
| Memory extraction (`src/lib/letta/memory-extract.ts`) | Session sync endpoint, Letta block writes | Sync-session API route |

---

## 12. Pattern Catalog

### Pattern 1: Add a New API Route

1. Create `src/app/api/your-route/route.ts`
2. Export named functions: `GET`, `POST`, `PATCH`, `DELETE`, etc.
3. For dynamic routes: `{ params }: { params: Promise<{ id: string }> }` — must `await params`
4. Parse JSON body with `await request.json()`
5. Validate input, return early with error responses
6. Call library functions (never put business logic in routes)
7. Return `NextResponse.json(data)` or `NextResponse.json({ error }, { status })`
8. Add test in `tests/api/your-route.test.ts` using `createRequest()` and `parseResponse()` helpers

### Pattern 2: Add a New Field to AgentConfig

This ripples through ~7 files:

1. **Type:** Add the field to the appropriate sub-interface in `src/lib/types.ts`
2. **Builder prompt:** Update the `STAGE_PROMPTS[stage]` in `src/lib/prompts/index.ts` to collect the field
3. **Builder route:** Add the field name to the valid fields list in `/api/chat/route.ts`
4. **Runtime prompt:** Read the field in `buildRuntimeSystemPrompt()` in `src/lib/runtime/prompt.ts`
5. **Letta translate:** Map the field in `translateToLettaParams()` in `src/lib/letta/translate.ts`
6. **Validation:** Add validation rules in `validateAgent()` in `src/lib/export.ts`
7. **Export:** Read the field in the relevant `generate*()` function in `src/lib/export.ts`
8. **Tests:** Update test factories (`createTestAgent()`) and add assertions

### Pattern 3: Add a New Letta Integration Function

1. Add the function to the appropriate module in `src/lib/letta/` (memory, translate, skills, or teams)
2. Start with the guard: `if (!isLettaEnabled() || !lettaClient) throw new Error(...)`
3. Use `lettaClient!` (non-null assertion) after the guard
4. Use snake_case for Letta SDK method parameters
5. Wrap in try/catch with descriptive error messages
6. Add test with per-file `vi.mock("@/lib/letta/client", ...)` — do NOT use `vi.hoisted()`

### Pattern 4: Add a New Zustand Store Action

1. Add the action signature to the store's state interface
2. Implement in the `create<State>((set, get) => ({ ... }))` body
3. Use `set()` for simple state updates, `set((state) => ...)` for updates based on current state
4. Never call API endpoints from store actions — that's TanStack Query's job
5. Add test in `tests/stores/your-store.test.ts` using `act()` for state changes

### Pattern 5: Add a New MCP Server Preset

1. Add an entry to `PRESET_REGISTRY` in `src/lib/runtime/mcp-presets.ts`:
   ```ts
   yourPreset: {
     label: "Display Name",
     description: "What it does (note required env vars)",
     definition: {
       name: "preset-name",        // Used in tool namespacing
       transport: "stdio",          // or "sse" | "http"
       command: "npx",
       args: ["-y", "@scope/server-package"],
       sandbox: { maxExecutionMs: 15000, allowNetwork: true },
     },
   },
   ```
2. The `MCP_PRESETS` map, `getPreset()`, and `listPresets()` are derived automatically
3. Add test in `tests/runtime/mcp-presets.test.ts`

### Pattern 6: Add a New Workspace Tab

1. Add the tab name to the `activeTab` union type in `src/stores/workspace-store.ts`
2. Create the panel component in `src/components/workspace/YourPanel.tsx`
3. Add the tab to the tab bar rendering in the workspace layout
4. Add conditional rendering in the main content area based on `activeTab`
5. If the tab needs a right panel, add to `rightPanelContent` union type
6. Update store tests in `tests/stores/workspace-store.test.ts`

---

## 13. Anti-Patterns

### 1. Mixing Prompt Contexts

`BASE_SYSTEM_PROMPT` is for the builder (guides the user). `TEST_SYSTEM_PROMPT` is for the sandbox (role-plays as the agent). `buildRuntimeSystemPrompt()` is for deployed agents. Each has a different persona and response format. Injecting one where another is expected produces nonsensical behavior.

### 2. Accessing capabilities/triggers Directly

```ts
// WRONG — breaks when config comes from a template (flat array)
const tools = config.capabilities?.tools ?? [];

// RIGHT — handles both nested and flat shapes
const tools = getTools(config);
```

Always use `getTools()` and `getTriggers()` from `src/lib/types.ts`.

### 3. Forgetting `await params` in Route Handlers

Next.js 16 makes route params Promises. This silently fails if you destructure without awaiting:
```ts
// WRONG
export async function GET(req, { params }) {
  const { id } = params; // params is a Promise, not the value
}

// RIGHT
export async function GET(req, { params }) {
  const { id } = await params;
}
```

### 4. Using `vi.hoisted()` for Letta Mocks

The `vi.hoisted()` destructuring pattern causes TDZ (Temporal Dead Zone) errors with vitest when mocking `@/lib/letta/client`. Instead:

```ts
// WRONG
const { mockIsLettaEnabled } = vi.hoisted(() => ({
  mockIsLettaEnabled: vi.fn(),
}));

// RIGHT
vi.mock("@/lib/letta/client", () => ({
  isLettaEnabled: vi.fn().mockReturnValue(true),
  lettaClient: { agents: { create: vi.fn() } },
}));
import { isLettaEnabled } from "@/lib/letta/client";
const mockIsLettaEnabled = isLettaEnabled as unknown as Mock;
```

### 5. Passing Raw JSON Strings to Library Functions

Library functions in `src/lib/` expect parsed objects. Route handlers are responsible for `JSON.parse()`.

```ts
// WRONG — inside a library function
const config = JSON.parse(agent.config);

// RIGHT — parse at the API boundary (route handler), pass parsed object to lib
```

### 6. Mutating Shared Letta Blocks Without Understanding Scope

Shared blocks (project, decisions, task_board, brand) are visible to ALL team members. Updating the `decisions` block from one agent changes what all agents see. The `project` and `brand` blocks are `read_only: true` for a reason.

### 7. Calling Letta Functions Without the Guard

Every Letta function must check `isLettaEnabled()` before accessing `lettaClient`. The client is nullable. Skipping the guard causes runtime crashes when Letta is not configured.

### 8. Amending Deployments Instead of Creating New Ones

Deployments are immutable snapshots (ADR-3). To apply config changes, create a new deployment. The deploy route automatically retires the old one.

---

## 14. Testing Strategy

### Layer Isolation

Tests mock at layer boundaries to isolate the system under test:

- **Route handler tests** (`tests/api/`) — Mock Prisma + Claude + Letta. Test HTTP semantics (status codes, response shapes, error handling).
- **Library tests** (`tests/lib/`) — Mock external dependencies only (Letta SDK, file system). Test business logic in isolation.
- **Runtime tests** (`tests/runtime/`) — Mock Claude API + MCP SDK. Test engine behavior, guardrails, tool execution.
- **Store tests** (`tests/stores/`) — No mocks needed. Test state transitions directly.
- **Flow tests** (`tests/flows/`) — Mock Prisma + Claude + Letta. Test multi-step sequences (create → build → deploy → chat).

### The Mock Boundary

`tests/setup.ts` globally mocks:
- `@/lib/db` — All 11 Prisma model mocks (findUnique, create, update, etc.)
- `@/lib/claude` — `chat()`, `chatWithTools()`, `inferFromDescription()`

**Not globally mocked** (must be mocked per-file):
- `@/lib/letta/client` — Because Letta is optional, its mock needs test-specific return values

### Testing a Change: Checklist

1. **Unit test the changed function** directly
2. **Test the API route** that calls it (if applicable)
3. **Test the flow** that uses the route (if the change affects a multi-step sequence)
4. **Run `npm test`** to verify no regressions (519 tests across 35 files)
5. **Run `npm run build`** to verify no TypeScript errors

### Test Helpers

- `getMockedPrisma()` — Type-safe access to globally mocked Prisma models
- `createTestAgent(overrides?)` — Factory for `AgentProject` test data
- `createTestTemplate(overrides?)` — Factory for `AgentTemplate` test data
- `createRequest(method, body?, params?)` — Creates `NextRequest` for route handler testing
- `parseResponse<T>(response)` — Extracts typed JSON body from `NextResponse`
- `cleanupDb()` — Resets all Prisma mock call counts between tests

---

## 15. Module Dependency Graph

```
src/app/api/
  ├── chat/route.ts ────────────→ lib/claude.ts
  │                                lib/prompts/index.ts
  │                                lib/types.ts
  │
  ├── agents/[id]/deploy/route.ts → lib/export.ts (validateAgent)
  │                                  lib/runtime/prompt.ts (buildRuntimeSystemPrompt)
  │                                  lib/letta/translate.ts
  │                                  lib/letta/skills.ts
  │                                  lib/mcp-helpers.ts
  │
  └── runtime/[slug]/chat/route.ts → lib/runtime/engine.ts
                                      lib/letta/client.ts

lib/runtime/
  ├── engine.ts ──→ lib/claude.ts (chat, chatWithTools)
  │                  runtime/guardrails.ts (checkPreMessage)
  │                  runtime/mcp-client.ts (McpClientManager)
  │
  ├── mcp-client.ts ──→ @modelcontextprotocol/sdk
  │
  ├── prompt.ts ──→ lib/types.ts (getTools)
  │
  └── guardrails.ts ──→ lib/types.ts (GuardrailsConfig)

lib/letta/
  ├── client.ts ──→ @letta-ai/letta-client
  │
  ├── translate.ts ──→ lib/runtime/prompt.ts (buildRuntimeSystemPrompt)
  │                     lib/types.ts (AgentConfig)
  │
  ├── memory.ts ──→ letta/client.ts
  │
  ├── skills.ts ──→ letta/client.ts
  │
  └── teams.ts ──→ letta/translate.ts    ← ORCHESTRATION LAYER
                    letta/memory.ts       Composes translate + memory + skills
                    letta/skills.ts       into team-level operations
                    letta/client.ts

lib/
  ├── claude.ts ──→ @anthropic-ai/sdk
  ├── types.ts ──→ (no internal deps — leaf module)
  ├── export.ts ──→ lib/types.ts (getTools, getTriggers, validateAgent)
  ├── db.ts ──→ @prisma/adapter-better-sqlite3
  └── claude-code/
      ├── generate-agents.ts ──→ lib/types.ts, lib/letta/translate.ts
      └── generate-project.ts ──→ claude-code/generate-agents.ts

packages/agent-os-mcp/ ──→ Agent OS HTTP API (external process, stdio transport)
  └── src/index.ts ──→ @modelcontextprotocol/sdk, zod, api-client.ts

stores/
  ├── workspace-store.ts ──→ zustand (no lib/ deps)
  ├── chat-store.ts ──→ zustand (no lib/ deps)
  └── memory-store.ts ──→ zustand (no lib/ deps)
```

**Key boundary:** `lib/letta/teams.ts` is the orchestration layer that composes `translate`, `memory`, and `skills` into team-level operations. It's the only module that imports from all three sibling Letta modules.

**Leaf modules:** `lib/types.ts` and the three Zustand stores have no internal dependencies — they're safe to change without import chain side effects.

---

## 16. Claude Code Integration Architecture

Agent OS agents can run natively in Claude Code with Letta-backed persistent memory via an MCP server bridge.

### The Bridge Model

```
Agent OS (web UI)                     Claude Code (native runtime)
─────────────────                     ──────────────────────────
Build agents (6-stage builder)        Run agents as subagents
Deploy to Letta (persistent memory)   Load memory via MCP server
Manage teams + shared blocks          Shared blocks via team context
Review/refine memory in UI            Auto-sync on session end
```

Agent OS owns agent identity and memory. Claude Code owns execution. The MCP server bridges the two.

### Memory Bridge: Letta Native vs. Claude Code

When agents run in the Agent OS web UI, Letta is in the inference loop — memory management is automatic via built-in tools (`core_memory_replace`, `archival_memory_insert`, etc.).

When agents run in Claude Code, Letta is NOT in the inference loop. The MCP server bridges the gap:

| Letta Native | Claude Code (via MCP) |
|---|---|
| `core_memory_replace` (built-in) | `mcp__agent-os__core_memory_replace` → API → Letta |
| Memory blocks injected in context | `load_context` tool injects current memory |
| Categorization prompt in system | Same prompt embedded in subagent `.md` file |
| Automatic on every turn | Agent calls tools explicitly + server-side sync fallback |

### Server-Side Memory Extraction

Since Claude Code's model may not reliably call memory tools while focused on coding, the sync endpoint provides a server-side fallback:

```
SubagentStop hook fires
  → MCP sync_session → POST /api/agents/[id]/sync-session
  → Agent OS calls Claude with extraction prompt
  → Categorizes: decisions, preferences, knowledge, task updates
  → Writes to Letta blocks (decisions block, persona block, archival, task_board)
  → Next session loads updated memory via load_context
```

The extraction prompt uses randomized boundary tags to mitigate prompt injection from session summary content.

### Generated File Structure

`POST /api/teams/[id]/generate-claude-code` produces:

```
.claude/agents/<name>/<name>.md    # Subagent definition (YAML frontmatter + markdown)
.mcp.json                          # Agent OS MCP server config
.claude/settings.json              # SubagentStop hooks for memory sync
CLAUDE-TEAM.md                     # Team context (members, roles, active project)
```

### ADR-7: MCP Server as Separate Package

**Context:** The MCP server needs to run as a standalone process (stdio transport) invoked by Claude Code. It cannot be part of the Next.js app.

**Decision:** Standalone package at `packages/agent-os-mcp/` with its own `package.json` and `tsconfig.json`. The `packages/` directory is excluded from the root tsconfig. The MCP server communicates with Agent OS via HTTP (the same API endpoints the web UI uses).

**Consequence:** The MCP server has no access to Prisma, the Letta client, or any server-side modules. It's a thin HTTP client. All business logic stays in the Next.js app. The server can be published to npm independently.

### ADR-8: Server-Side Memory Extraction Over Client-Side

**Context:** Claude Code agents are focused on coding tasks and may not reliably call memory tools during work. How do we ensure memory is updated?

**Decision:** Provide both client-side tools (agents can call memory tools directly) AND a server-side fallback (`sync_session` → Claude-based extraction → Letta writes). SubagentStop hooks trigger the fallback automatically.

**Consequence:** Memory updates are reliable regardless of whether the agent remembers to call tools. The server-side path costs one additional Claude API call per session sync. Pre-categorized input (when the agent explicitly lists decisions/preferences/knowledge) skips the Claude call.

---

## 17. Cross-Reference to CLAUDE.md

**CLAUDE.md** = Operational reference. Commands, API route listings, environment variables, test file locations, key gotchas, dependencies. Answers: "How do I run this? What endpoints exist? What are the env vars?"

**ARCHITECTURE.md** = Conceptual reference. System thinking, data flows, decision rationale, change impact analysis, code patterns. Answers: "How does the system think? What happens if I change X? Why was it built this way?"

Neither document duplicates the other. CLAUDE.md tells you *what exists*. ARCHITECTURE.md tells you *how it works together*.
