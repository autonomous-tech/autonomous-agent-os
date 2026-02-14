# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Agent OS is a platform for building, deploying, and evolving AI agents with persistent memory. Agents get better over time through self-editing memory powered by Letta. The platform combines a direct-editing agent builder with AI enrichment, a workspace for deploying agents, inspecting memory, and bridging to Claude Code.

**Three modes of operation:**
1. **Builder** — Section-card editor mapping 1:1 to AGENT-MD-SPEC sections (Identity, Purpose, Audience, Workflow, Memory Protocol, Boundaries) with real-time AI enrichment
2. **Workspace** — Deploy agents, chat with them, inspect memory, and manage tools
3. **Claude Code Bridge** — Export agents as Claude Code subagents with persistent Letta memory via MCP server

## Commands

```bash
# Development
npm run dev                          # Next.js dev server on http://localhost:3000
docker compose up -d                 # Start 3-service stack (app + Letta + Postgres)

# Testing
npm test                             # Run all Vitest unit/integration tests (480 tests, 38 files)
npm run test:watch                   # Vitest in watch mode
npx vitest run tests/api/agents.test.ts  # Run a single test file
npm run test:e2e                     # Playwright E2E tests (auto-starts dev server)
npm run test:coverage                # Vitest with coverage

# Build & Lint
npm run build                        # Production build (standalone output)
npm run lint                         # ESLint

# Database
npx prisma migrate dev               # Run migrations
npx prisma generate                  # Regenerate Prisma client
npx prisma db seed                   # Seed 3 templates + 4 specialist agents
```

## Architecture

**Stack:** Next.js 16 (App Router) + React 19 + TailwindCSS 4 + Shadcn/ui + Prisma 7 + SQLite + Anthropic Claude API + Letta (MemGPT) + Zustand + TanStack Query

**Runtime model:** All chat goes through the Claude engine (`src/lib/runtime/engine.ts`). Agents with a `lettaAgentId` have their system prompt hydrated with Letta memory blocks before each chat turn. Agents without a `lettaAgentId` use Claude without persistent memory. Memory sync happens periodically (every 10 turns or session end) via Claude-powered categorization. This is handled in `/api/runtime/[slug]/chat/route.ts`.

```
Next.js (port 3000)  ──  Claude Engine  ──  Anthropic API
       │
       └── @letta-ai/letta-client  ──  Letta Server (Docker, port 8283)
                                              │
                                         Memory Only
                                    (hydrate + sync learnings)
```

### Docker Setup

Three-service `docker-compose.yml`:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `app` | Local Dockerfile | 3000 | Agent OS (Next.js standalone) |
| `letta-server` | `letta/letta:latest` | 8283 | Letta memory server |
| `letta-postgres` | `postgres:16-alpine` | — | Letta backend database |

The `Dockerfile` uses a multi-stage build (base → deps → builder → runner) with a non-root `nextjs` user. `docker-entrypoint.sh` runs Prisma migrations then starts the server. SQLite data persists in a named volume (`app-data:/app/data`).

### Data Layer

6 Prisma models (`prisma/schema.prisma`): `AgentProject`, `AgentTemplate`, `Deployment`, `ChatSession`, `McpServerConfig`, `ToolExecutionLog`. SQLite has no native JSON type, so `config`, `stages`, `conversations`, `messages`, `mcpConfig`, `env`, `sandboxConfig`, `args`, `allowedTools`, `blockedTools`, `metadata`, `input`, and `output` are stored as JSON strings in `String` columns. The API layer handles `JSON.parse`/`JSON.stringify` at the boundary.

The Prisma client (`src/lib/db.ts`) uses `@prisma/adapter-better-sqlite3` with a dev-mode global singleton pattern. Generated client output goes to `src/generated/prisma`.

**Key fields for Letta integration:**
- `AgentProject.lettaAgentId` — Links to the Letta agent instance (nullable; null means no persistent memory)
- `Deployment.lettaAgentId` — Snapshot of lettaAgentId at deploy time

**Template shape mismatch:** Templates use flat arrays for capabilities/triggers, while `AgentConfig` uses nested objects. Helper functions `getTools()` and `getTriggers()` in `src/lib/types.ts` bridge this gap — always use them instead of accessing these fields directly.

### API Routes (`src/app/api/`)

All API routes are Next.js App Router route handlers. 22 route files, 36 HTTP method handlers.

**Templates:**
- `/api/templates` — GET (list all templates)

**Agent CRUD & builder:**
- `/api/agents` — GET (list), POST (create with AI inference)
- `/api/agents/[id]` — GET, PATCH (merges config), DELETE
- `/api/agents/[id]/stages/[stage]` — PUT (replaces entire section)
- `/api/agents/[id]/enrich` — POST (AI enrichment for section cards: returns suggestions, ideas, questions)
- `/api/chat` — POST (builder conversation endpoint)
- `/api/test` — POST (test sandbox, role-plays as the built agent)

**Deployment & runtime:**
- `/api/agents/[id]/deploy` — POST (deploy + Letta side-deploy), GET (status), DELETE (pause), PATCH (resume)
- `/api/runtime/[slug]/chat` — POST (runtime chat, hydrates with Letta memory, syncs learnings)
- `/api/runtime/[slug]` — GET (public agent info for initial page load)

**Sessions:**
- `/api/agents/[id]/sessions` — GET (list chat sessions)
- `/api/agents/[id]/sessions/[sessionId]` — GET (session transcript)

**Letta proxy (credentials stay server-side):**
- `/api/letta/agents/[lettaId]/memory` — GET (list blocks)
- `/api/letta/agents/[lettaId]/memory/[label]` — GET (block), PUT (update with 10k char limit)
- `/api/letta/agents/[lettaId]/archival` — GET (search/list), POST (insert with 50k char limit)

**Claude Code integration:**
- `/api/agents/by-slug/[slug]` — GET (resolve agent by slug, used by MCP server)
- `/api/agents/by-slug/[slug]/sync-session` — POST (receive session summary by slug, for SubagentStop hooks)
- `/api/agents/[id]/sync-session` — POST (receive session data by ID, trigger memory extraction)
- `/api/agents/[id]/claude-code-export` — GET (generate Claude Code export files: .md, .mcp.json, settings.json)

**MCP servers:**
- `/api/agents/[id]/mcp-servers` — GET (list), POST (add with transport validation)
- `/api/agents/[id]/mcp-servers/[serverId]` — PATCH (update), DELETE (remove)
- `/api/agents/[id]/mcp-servers/[serverId]/test` — POST (test connection)

### Letta Integration (`src/lib/letta/`)

Five modules:

- **`client.ts`** — Singleton `lettaClient` (nullable). `isLettaEnabled()` guard. Returns `null` if `LETTA_BASE_URL` is unset.
- **`translate.ts`** — `translateToLettaParams()` converts `AgentConfig` to Letta create params (persona block, scratchpad, memory instructions).
- **`memory.ts`** — `createSharedProjectBlocks()` (4 blocks: project, decisions, task_board, brand), `attachSharedBlocks()`, `detachSharedBlocks()`, `getAgentMemorySnapshot()`, `hydrateSystemPromptWithMemory()` (appends memory blocks to system prompt, gracefully degrades on failure).
- **`memory-extract.ts`** — Server-side memory extraction from session summaries. `extractMemoryFromSession()` uses Claude to categorize learnings into persona/decisions/archival. `persistExtractedMemory()` writes to Letta blocks. `syncSessionMemory()` combines both steps.
- **`skills.ts`** — `loadSkillToArchival()` reads SKILL.md, chunks at ~1000 char paragraph boundaries, inserts tagged passages. `loadSkillsDirectory()` recursively finds and loads all SKILL.md files.

**All Letta functions throw if `isLettaEnabled()` returns false.** This makes the Letta integration fully optional — the app works without Docker/Letta running.

### Claude Integration (`src/lib/claude.ts`)

Three exported functions: `chat()`, `chatWithTools()`, and `inferFromDescription()`. Uses `claude-sonnet-4-5-20250929`. `chat()` defaults to 2048 max tokens, `chatWithTools()` to 4096. System prompts are in `src/lib/prompts/index.ts`. `inferFromDescription()` accepts a string or structured object and has a fallback that returns a minimal config if Claude's JSON response is malformed. Both `chat()` and `inferFromDescription()` strip markdown code fences from Claude's response before parsing JSON.

**Enrichment pipeline (`src/lib/prompts/enrich.ts`):** `buildEnrichmentPrompt(section, sectionData, fullConfig)` generates per-section prompts for AI enrichment. Called by `/api/agents/[id]/enrich` which returns `EnrichmentResponse` (suggestions, ideas, questions). Each section type has tailored `SECTION_CONTEXT` guidance (identity focus on memorability, purpose on task completeness, workflow on capability coverage, etc.). Responses are capped at 2 suggestions, 3 ideas, 1 question per call.

### Frontend

**Pages:**
- `/` — Dashboard with agent grid, deployed agent stats, quick-create card
- `/agents/new` — 4-step wizard: archetype selection → audience → name → review
- `/agents/[id]` — 2-column builder: left column with scrollable section cards (Identity, Purpose, Audience, Workflow, Memory, Boundaries) for direct editing with AI enrichment callouts, right column with `LivePreview` showing real-time AGENT-MD-SPEC output (agent.md, .mcp.json, settings.json tabs). Header bar has Try It, Export, Deploy, and Save controls.
- `/agents/[id]/workspace` — Post-deployment workspace with tabbed UI: Chat | Memory | Tools | Artifacts | Settings
- `/a/[slug]` — Public deployed agent interface

**State management:**
- `src/stores/chat-store.ts` — Messages, streaming state, partial content, error (Zustand)
- `src/stores/memory-store.ts` — Memory blocks, archival results, archival query, loading state (Zustand)
- `src/components/providers.tsx` — QueryClient (TanStack Query) provider with 30s stale time

**Workspace components (`src/components/workspace/`):**
- `chat/ChatPanel.tsx` — Message list with streaming, input with send button
- `chat/StreamingMessage.tsx` — Typewriter effect with reasoning collapsible, markdown rendering
- `chat/ToolCallInline.tsx` — Collapsible tool call block with status icons
- `memory/MemoryPanel.tsx` — Core memory block list + archival search
- `memory/MemoryBlockCard.tsx` — Editable block with usage bar and save/cancel
- `tools/ToolLogPanel.tsx` — MCP execution log from chat messages

**Builder components (`src/components/builder/`):**
- `SectionCard.tsx` — Base card wrapper with title, icon, status badge (empty/draft/done), and AI callout slots
- `cards/IdentityCard.tsx` — Name, emoji, vibe, tone (PillSelector), greeting fields
- `cards/PurposeCard.tsx` — Description textarea, tasks list (TagInput)
- `cards/AudienceCard.tsx` — Primary audience, scope selector
- `cards/WorkflowCard.tsx` — Capabilities table (name, access, description) + triggers list
- `cards/MemoryCard.tsx` — Strategy selector (PillSelector), remember items (TagInput)
- `cards/BoundariesCard.tsx` — Behavioral rules (TagInput), exclusions (TagInput), prompt injection defense
- `AiCallout.tsx` — AI enrichment callout component (3 variants: suggestion with accept/dismiss, idea with add/skip, question with option buttons)
- `TagInput.tsx` — Reusable tag input with Enter-to-add and Backspace-to-remove
- `PillSelector.tsx` — Reusable pill-style radio selector for enum values
- `LivePreview.tsx` — Real-time AGENT-MD-SPEC preview with 3 file tabs (agent.md, .mcp.json, settings.json), rendered markdown view with section highlighting, copy/download actions
- `TestChat.tsx` — Test mode chat (role-plays as the built agent)
- `McpServerPanel.tsx` — MCP server configuration panel
- `AgentCard.tsx` — Agent card for grid display
- `ClaudeCodeExportDialog.tsx` — Claude Code export dialog with file previews and CLI instructions
- `PreviewPane.tsx` — **Deprecated.** Legacy 3-pane preview with collapsible sections and inline editing. Replaced by section cards + LivePreview.
- `Sidebar.tsx` — **Deprecated.** Legacy 6-stage navigation sidebar. Replaced by scrollable section cards.
- `ChatPane.tsx` — **Deprecated.** Legacy conversational builder interface. Replaced by direct editing with AI enrichment.

### Section-Card Builder Model

The builder uses 6 section cards that map 1:1 to AGENT-MD-SPEC sections: Identity, Purpose, Audience, Workflow, Memory Protocol, Boundaries. Each card has a `CardStatus` of `"empty"` → `"draft"` → `"done"` computed from its content (e.g., IdentityCard is `"done"` when both `name` and `tone` are set). Users edit fields directly in the cards rather than through a chat conversation.

**AI enrichment replaces chat-driven building:** When a user edits a section, the builder debounces (1.5s) a call to `/api/agents/[id]/enrich` which returns suggestions, ideas, and questions via `AiCallout` components rendered below the card's fields. Users can accept, dismiss, or answer these callouts. The enrichment pipeline uses `buildEnrichmentPrompt()` from `src/lib/prompts/enrich.ts` with per-section context.

**Section-to-config mapping:** Sections map to `AgentConfig` keys as follows: identity → `identity`, purpose → `mission` (description + tasks), audience → `mission.audience`, workflow → `capabilities` + `triggers`, memory → `memory`, boundaries → `guardrails` + `mission.exclusions`. The `SectionName` type and `SECTION_NAMES` constant are defined in `src/lib/types.ts`.

**Auto-save:** Config changes trigger a debounced auto-save (3s) via PATCH to `/api/agents/[id]`.

**Project status workflow:** `"draft"` → `"building"` (set on first interaction) → `"deployed"` (set after deployment). The legacy `StageData` (6 stages with `"incomplete"` → `"draft"` → `"approved"` status) is still stored but the builder UI now computes card status from config content directly.

**Legacy stage system:** The 6 internal stages (mission, identity, capabilities, memory, triggers, guardrails) and their `STAGE_PROMPTS`/`COMPLETION_CRITERIA` in `src/lib/prompts/index.ts` remain for backward compatibility but are no longer the primary editing model.

### Memory Architecture

Two scopes:
1. **Agent** — Persona block + scratchpad + archival memory. Persists across sessions. Stores identity, user preferences, and craft knowledge.
2. **Session** — Chat messages stored in `ChatSession.messages`. Capped at 40 messages.

Memory sync flow (in runtime chat):
- Every 10 turns or on session end, `syncSessionMemory()` fires asynchronously
- Claude categorizes learnings from recent messages into three buckets:
  - User preferences → agent's `persona` block
  - Project-specific facts → `decisions` block (if exists)
  - Reusable knowledge → archival memory (tagged `session-extract`)
- Block updates enforce a 10k character limit; archival inserts enforce 50k

### MCP Server Presets (`src/lib/runtime/mcp-presets.ts`)

5 pre-configured MCP servers: `filesystem` (10s, no network), `git` (15s, no network), `browser` (Puppeteer, 30s), `jiraCloud` (15s, requires env vars), `vercel` (30s, requires VERCEL_TOKEN).

`getPreset(key)` returns a deep copy. `listPresets()` returns metadata for UI display.

### Claude Code Integration (`src/lib/claude-code/`)

One module that generates Claude Code project files from Agent OS agent configs:

- **`generate-agent.ts`** — Pure functions: `generateAgentMd()` creates a `.claude/agents/<slug>.md` file matching the AGENT-MD-SPEC exactly — YAML frontmatter (name, description, tools, model, maxTurns, optional disallowedTools) and 6 markdown sections (# Identity, ## Purpose, ## Audience, ## Workflow, ## Memory Protocol, ## Boundaries). Section cards in the builder map 1:1 to these output sections. `generateMcpJson()` creates `.mcp.json`. `generateSettingsJson()` creates `.claude/settings.json` with SubagentStop hooks. `generateClaudeCodeFiles()` combines all three. The `LivePreview` component calls these functions client-side for real-time preview.

### Agent OS MCP Server (`packages/agent-os-mcp/`)

Standalone Node.js MCP server using `@modelcontextprotocol/sdk` (stdio transport). Bridges Claude Code to Agent OS persistent memory via Letta.

```bash
# Add to Claude Code
claude mcp add agent-os -s user -- npx agent-os-mcp --url http://localhost:3000

# Or configure in .mcp.json
{ "mcpServers": { "agent-os": { "command": "npx", "args": ["agent-os-mcp", "--url", "http://localhost:3000"] } } }
```

**7 MCP tools:**
- `load_context` — Bootstrap session with full agent identity + memory state
- `get_memory_blocks` — Read all current memory block values
- `core_memory_replace` — Find-and-replace in a memory block
- `core_memory_append` — Append text to a memory block
- `archival_search` — Semantic search over archival memory
- `archival_insert` — Store in long-term archival memory
- `sync_session` — Send session summary for server-side memory extraction

**Package structure:**
```
packages/agent-os-mcp/
├── package.json, tsconfig.json
├── bin/agent-os-mcp.mjs          # CLI entry point
├── src/
│   ├── index.ts                  # MCP server setup + tool registration (Zod schemas)
│   ├── config.ts                 # CLI args (--url, --agent), env vars, URL validation
│   ├── api-client.ts             # HTTP client wrapping Agent OS API endpoints
│   └── tools/
│       ├── context.ts            # load_context handler
│       ├── memory.ts             # get_memory_blocks, core_memory_replace, core_memory_append
│       ├── archival.ts           # archival_search, archival_insert
│       └── sync.ts               # sync_session
└── dist/                         # Compiled output (tsc)
```

**Note:** The `packages/` directory is excluded from the Next.js tsconfig. The MCP server has its own `tsconfig.json` targeting ES2022 with ESM modules.

## Testing

480 tests across 38 files + 5 Playwright E2E spec files. Tests are in `tests/`.

**Test setup (`tests/setup.ts`):** Globally mocks `@/lib/db` (all 6 Prisma models) and `@/lib/claude` (3 functions: `chat`, `chatWithTools`, `inferFromDescription`) so no real database or API calls are made. Individual tests override these mocks as needed.

**Test helpers:**
- `tests/helpers/db.ts` — `getMockedPrisma()` for type-safe mock access, `createTestAgent()`/`createTestTemplate()` factories, `createRequest()` for route handler testing, `parseResponse<T>()` for response extraction, `cleanupDb()` to reset all mocks.
- `tests/helpers/fixtures.ts` — `sampleAgentConfig`, `sampleStageData`, `incompleteAgentConfig`, `createMockAgentProject()`, `createMockDeployment()`, `createMockChatSession()`, and other test data factories.

**Mocking Letta in tests:** The `@/lib/letta/client` module must be mocked per-test-file (not globally) since it's optional. Use inline `vi.fn()` inside `vi.mock()` factories — do NOT use `vi.hoisted()` destructuring pattern as it causes TDZ errors with vitest 4.x. Instead, import the mocked module and cast to `Mock`:

```ts
vi.mock("@/lib/letta/client", () => ({
  isLettaEnabled: vi.fn().mockReturnValue(true),
  lettaClient: { blocks: { create: vi.fn() }, agents: { ... } },
}));
import { lettaClient, isLettaEnabled } from "@/lib/letta/client";
const mockIsLettaEnabled = isLettaEnabled as unknown as Mock;
```

**Test categories:**
- `tests/api/` (17 files) — Route handler tests (agents, deploy, chat, runtime, sessions, Letta memory, MCP servers, Claude Code export, sync-session, agent-by-slug, enrich)
- `tests/lib/` (8 files) — Library module tests (slug, export, validation, Letta translate/modules, Claude Code generate, memory extract)
- `tests/runtime/` (7 files) — Engine, engine integration, engine tools, guardrails, prompt, MCP client, MCP presets
- `tests/stores/` (1 file) — Zustand store tests for chat and memory stores
- `tests/flows/` (5 files) — Integration flows (deploy+chat, redeployment, pause/resume, guardrail enforcement, session lifecycle)
- `tests/e2e/` (5 specs) — Playwright specs (agent-list, builder, deploy, new-agent, public-chat)

E2E tests use Playwright targeting Chromium against `http://localhost:3000`. E2E helpers in `tests/e2e/helpers.ts` provide `createDeployableAgent()` and `deleteAgent()`.

## Path Alias

`@/*` maps to `./src/*` (configured in both `tsconfig.json` and `vitest.config.ts`).

## Key Gotchas

- **Next.js 16 route params are Promises:** Dynamic route handlers must `await params` before accessing `.id`, `.stage`, etc.
- **Slug uniqueness:** Generated via `generateSlug(name) + "-" + Date.now().toString(36)` in the `/api/agents` POST handler — the base36 timestamp prevents collisions.
- **PATCH config merges, not replaces:** Partial config updates are merged with existing config. Stage config updates (via `/api/agents/[id]/stages/[stage]`) replace the entire section.
- **Prompt architecture:** `BASE_SYSTEM_PROMPT` is the builder persona (guides the user). `TEST_SYSTEM_PROMPT` flips to the agent persona (role-plays as the built agent). `STAGE_PROMPTS` has per-stage appendices. These are distinct — don't mix them.
- **Field name mappings:** The `/api/chat` route injects stage-specific valid field names into the system prompt so Claude knows which `previewUpdates` fields are valid for the current stage.
- **Letta is optional:** All Letta functions guard with `isLettaEnabled()`. The app runs without Docker/Letta — agents just use the Claude engine without persistent memory.
- **Letta SDK uses snake_case:** `agent_id`, `memory_blocks`, `read_only`, `created_at`. The Letta proxy routes map to camelCase for the frontend.
- **`lettaClient` is nullable:** After the `isLettaEnabled()` guard, use `lettaClient!` (non-null assertion) to access methods.
- **vi.hoisted() TDZ bug:** Do NOT destructure from `vi.hoisted()` when mocking `@/lib/letta/client` in tests. Use inline `vi.fn()` in `vi.mock()` factories and cast imports instead.
- **MCP server is a separate package:** `packages/agent-os-mcp/` has its own `tsconfig.json` and `package.json`. It is excluded from the root tsconfig via the `exclude` array. Run `npm run build` in the package directory to compile it independently.
- **MCP SDK requires Zod schemas:** The `@modelcontextprotocol/sdk` server API requires Zod types for tool parameter schemas, not plain JSON Schema objects. Tools in `index.ts` use `z.string()`, `z.array()`, etc.
- **Memory extraction uses Claude:** `syncSessionMemory()` calls Claude to categorize session learnings. This means `ANTHROPIC_API_KEY` must be set for session sync to work.
- **Generated subagent files include memory protocol:** Only agents with a `lettaAgentId` get the memory protocol section and `mcp__agent-os__*` tool access in their generated `.md` files.
- **Standalone Docker output:** `next.config.ts` sets `output: "standalone"` and externalizes `better-sqlite3` via `serverExternalPackages`.
- **AI enrichment is non-blocking:** The enrichment pipeline is debounced (1.5s after edit), fires asynchronously, and silently ignores errors. It never blocks the user's editing flow. Callouts appear below section cards and can be accepted, dismissed, or answered without affecting save state.
- **`generateAgentMd` matches AGENT-MD-SPEC exactly:** The output structure (6 sections: Identity, Purpose, Audience, Workflow, Memory Protocol, Boundaries) maps 1:1 to the builder's section cards. The `LivePreview` component renders this output in real-time with section highlighting.
- **Section cards compute status from config content:** Unlike the legacy stage system where status was explicitly set via chat, `CardStatus` (`"empty"` / `"draft"` / `"done"`) is computed by each card component from the current config values (e.g., IdentityCard is `"done"` when `name` and `tone` are present).

## Environment Variables

Copy `.env.sample` → `.env`.

**Required:**
- `DATABASE_URL` — SQLite path (defaults to `file:./dev.db`)
- `ANTHROPIC_API_KEY` — Claude API key

**Optional (Letta integration):**
- `LETTA_BASE_URL` — Letta server URL (e.g., `http://localhost:8283`). If unset, Letta features are disabled.
- `LETTA_SERVER_PASSWORD` — Letta auth (defaults to `"letta"`)
- `LETTA_DEFAULT_MODEL` — Override model (defaults to `anthropic/claude-sonnet-4-5-20250929`)
- `LETTA_DEFAULT_EMBEDDING` — Override embedding (defaults to `openai/text-embedding-3-small`)

## Skills

SKILL.md files in `skills/` are loaded into agent archival memory at deploy time. Each skill is chunked at ~1000 char paragraph boundaries and tagged for retrieval.

Current skills:
- `skills/brand-guide/SKILL.md` — Autonomous brand colors, typography, component patterns, voice & tone
- `skills/frontend-design/SKILL.md` — Next.js 16 patterns, App Router, Tailwind CSS, React 19
- `skills/payload-cms/SKILL.md` — PayloadCMS integration patterns

## Documentation

- `docs/agent-os-overview.html` — Standalone HTML documentation with architecture diagrams, memory model, API reference, frontend components, execution phases, test coverage, and decision log. Styled with Autonomous brand design system.
