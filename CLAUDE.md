# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Agent OS is a project workspace where you work WITH AI agent teams on real projects. Agents get better over time through persistent, self-editing memory. The platform combines a conversational agent builder with a workspace for deploying agents, managing teams, and observing agent memory evolution.

**Two modes of operation:**
1. **Builder** — 6-stage guided process to create agent configurations (Mission → Identity → Capabilities → Memory → Triggers → Guardrails)
2. **Workspace** — Deploy agents, chat with them, inspect memory, manage tools, and coordinate multi-agent teams

## Commands

```bash
# Development
npm run dev                          # Next.js dev server on http://localhost:3000
docker compose up -d                 # Start Letta server + Postgres (port 8283)

# Testing
npm test                             # Run all Vitest unit/integration tests (519 tests, 35 files)
npm run test:watch                   # Vitest in watch mode
npx vitest run tests/api/agents.test.ts  # Run a single test file
npm run test:e2e                     # Playwright E2E tests (auto-starts dev server)
npm run test:coverage                # Vitest with coverage

# Build & Lint
npm run build                        # Production build (33 routes)
npm run lint                         # ESLint

# Database
npx prisma migrate dev               # Run migrations
npx prisma generate                  # Regenerate Prisma client
npx prisma db seed                   # Seed 3 templates + 4 specialist agents
```

## Architecture

**Stack:** Next.js 16 (App Router) + React 19 + TailwindCSS 4 + Shadcn/ui + Prisma 7 + SQLite + Anthropic Claude API + Letta (MemGPT) + Zustand + TanStack Query

**Hybrid runtime:** Agents with a `lettaAgentId` use Letta for chat (self-editing memory, shared blocks). Agents without fall back to the existing Claude-based engine. This is determined at chat time in `/api/runtime/[slug]/chat/route.ts`.

```
Next.js (port 3000)  ──  @letta-ai/letta-client  ──  Letta Server (Docker, port 8283)
                                                            │
                                               ┌────────────┼────────────┐
                                          Filesystem    Git    Vercel    Browser
                                          MCP Server  MCP     MCP       MCP
```

### Data Layer

11 Prisma models (`prisma/schema.prisma`): `AgentProject`, `AgentTemplate`, `Deployment`, `ChatSession`, `McpServerConfig`, `ToolExecutionLog`, `AgentTeam`, `TeamMembership`, `TeamProject`, `Task`, `Artifact`. SQLite has no native JSON type, so `config`, `stages`, `conversations`, `orchestrationConfig`, and `lettaBlockIds` are stored as JSON strings in `String` columns. The API layer handles `JSON.parse`/`JSON.stringify` at the boundary.

The Prisma client (`src/lib/db.ts`) uses `@prisma/adapter-better-sqlite3` with a dev-mode global singleton pattern. Generated client output goes to `src/generated/prisma/client`.

**Key fields added for Letta integration:**
- `AgentProject.lettaAgentId` — Links to the Letta agent instance (nullable; null means Claude-only)
- `Deployment.lettaAgentId` — Snapshot of lettaAgentId at deploy time
- `TeamMembership.lettaAgentId` — Letta agent ID for team context
- `TeamProject.lettaBlockIds` — JSON with shared memory block IDs (`project`, `decisions`, `taskBoard`, `brand`)

**Template shape mismatch:** Templates use flat arrays for capabilities/triggers, while `AgentConfig` uses nested objects. Helper functions `getTools()` and `getTriggers()` in `src/lib/types.ts` bridge this gap — always use them instead of accessing these fields directly.

### API Routes (`src/app/api/`)

All API routes are Next.js App Router route handlers. 33 routes total.

**Agent CRUD & builder:**
- `/api/agents` — GET (list), POST (create with AI inference)
- `/api/agents/[id]` — GET, PATCH (merges config), DELETE
- `/api/agents/[id]/stages/[stage]` — GET, PUT (replaces entire section)
- `/api/chat` — Builder conversation endpoint
- `/api/test` — Test sandbox (role-plays as the built agent)
- `/api/export` — ZIP generation with validation

**Deployment & runtime:**
- `/api/agents/[id]/deploy` — POST (deploy + Letta side-deploy), GET (status), DELETE (pause), PATCH (resume)
- `/api/runtime/[slug]/chat` — Runtime chat (routes to Letta or Claude engine)
- `/api/runtime/[slug]` — GET runtime agent info

**Letta proxy (credentials stay server-side):**
- `/api/letta/agents/[lettaId]/memory` — GET (list blocks)
- `/api/letta/agents/[lettaId]/memory/[label]` — GET (block), PUT (update with 10k char limit)
- `/api/letta/agents/[lettaId]/archival` — GET (search/list), POST (insert with 50k char limit)
- `/api/letta/agents/[lettaId]/messages/stream` — POST (SSE streaming chat)

**Teams:**
- `/api/teams` — GET (list), POST (create)
- `/api/teams/[id]` — GET, PATCH, DELETE
- `/api/teams/[id]/deploy` — POST (deploy all members to Letta, create shared blocks)
- `/api/teams/[id]/members` — POST (add), DELETE (remove)
- `/api/teams/[id]/projects` — GET (list), POST (create with shared memory blocks)

**MCP servers:**
- `/api/agents/[id]/mcp-servers` — CRUD for MCP server configs
- `/api/agents/[id]/mcp-servers/[serverId]/test` — POST (test connection)

### Letta Integration (`src/lib/letta/`)

Six modules:

- **`client.ts`** — Singleton `lettaClient` (nullable). `isLettaEnabled()` guard. Uses `LETTA_BASE_URL` env var.
- **`translate.ts`** — `translateToLettaParams()` converts `AgentConfig` to Letta create params (persona block, scratchpad, memory instructions). `buildMemoryCategorizationPrompt()` returns the system prompt appendix for memory self-categorization.
- **`memory.ts`** — `createSharedProjectBlocks()` (4 blocks: project, decisions, task_board, brand), `attachSharedBlocks()`, `detachSharedBlocks()`, `getAgentMemorySnapshot()`.
- **`skills.ts`** — `loadSkillToArchival()` reads SKILL.md, chunks at ~1000 char paragraph boundaries, inserts tagged passages. `loadSkillsDirectory()` recursively finds and loads all SKILL.md files.
- **`teams.ts`** — `deployTeamToLetta()`, `setupProjectMemory()`, `attachProjectToTeam()`, `detachProjectFromTeam()`, `loadTeamSkills()`.
- **`messages.ts`** — SSE streaming helpers for Letta message proxy.

**All Letta functions throw if `isLettaEnabled()` returns false.** This makes the Letta integration fully optional — the app works without Docker/Letta running.

### Claude Integration (`src/lib/claude.ts`)

Two exported functions: `chat()` and `inferFromDescription()`. Uses `claude-sonnet-4-5-20250929` with 2048 max tokens. System prompts are in `src/lib/prompts/index.ts`. `inferFromDescription()` has a fallback that returns a minimal config if Claude's JSON response is malformed. Both functions strip markdown code fences from Claude's response before parsing JSON.

### Frontend

**Pages:**
- `/` — Dashboard with agent grid, activity indicators, quick-create cards
- `/agents/new` — Quick-create (name + description) or guided builder
- `/agents/[id]` — Workspace with tabbed UI: Chat | Memory | Tools | Artifacts | Settings
- `/teams` — Team list with member counts and status badges
- `/teams/new` — Create team (name, description, select agent members)
- `/teams/[id]` — Team workspace with agent tabs, shared memory panel, projects, activity feed
- `/a/[slug]` — Public deployed agent interface

**Workspace layout (3-pane):**
- **NavRail** (`src/components/workspace/NavRail.tsx`): 48px icon-only sidebar, agent list
- **Main content**: Tab bar (Chat | Memory | Tools | Artifacts | Settings) + active panel
- **Right panel**: Contextual (memory blocks, tool logs, artifacts)

**State management:**
- `src/stores/workspace-store.ts` — Active agent/team, active tab, sidebar, right panel, command palette (Zustand)
- `src/stores/chat-store.ts` — Messages, streaming state, partial content, tool calls, memory updates (Zustand)
- `src/stores/memory-store.ts` — Memory blocks, active block, editing state, archival search (Zustand)
- `src/components/providers.tsx` — QueryClient (TanStack Query) + Zustand hydration wrapper

**Workspace components (`src/components/workspace/`):**
- `ChatPanel.tsx` — Message list with streaming, input with quick replies
- `StreamingMessage.tsx` — Typewriter effect with reasoning accordion
- `ToolCallInline.tsx` — Collapsible tool call block with status indicator
- `MemoryPanel.tsx` — Block list, archival search, manual insert
- `MemoryBlockCard.tsx` — Editable block with usage bar and save/cancel
- `ToolLogPanel.tsx` — MCP execution log with filtering and duration

### 6-Stage Builder Model

Stages flow: Mission → Identity → Capabilities → Memory → Triggers → Guardrails. Each stage has status: `"incomplete"` → `"draft"` → `"approved"`. Stage-specific system prompts guide Claude to collect the right information at each step.

**Project status workflow:** `"draft"` → `"building"` (set on first chat interaction) → `"deployed"` (set after deployment). Conversation history is capped at 40 messages (20 turns) per stage to prevent unbounded growth.

### Memory Architecture

Three scopes:
1. **Global** (per agent) — Persona block + archival memory. Survives across projects. General expertise and user preferences.
2. **Project** (shared across team) — Four shared Letta blocks (`project`, `decisions`, `task_board`, `brand`). Attached/detached when switching projects.
3. **Session** (per conversation) — Letta recall memory. Automatically managed.

Agents are prompted to self-categorize what they learn:
- Project-specific facts → shared `decisions` block
- User preferences → agent's `persona` block
- Craft knowledge → agent's archival memory

### MCP Server Presets (`src/lib/runtime/mcp-presets.ts`)

5 pre-configured MCP servers: `filesystem` (10s, no network), `git` (15s, no network), `browser` (Puppeteer, 30s), `jiraCloud` (15s, requires env vars), `vercel` (30s, requires VERCEL_TOKEN).

`getPreset(key)` returns a deep copy. `listPresets()` returns metadata for UI display.

### Export & Validation (`src/lib/export.ts`)

`validateAgent()` produces structural errors (block export) and completeness/consistency warnings (non-blocking). The ZIP export generates provider-agnostic Markdown + YAML files.

## Testing

519 tests across 35 files + 6 Playwright E2E spec files. Tests are in `tests/`.

**Test setup (`tests/setup.ts`):** Globally mocks `@/lib/db` (all 11 Prisma models) and `@/lib/claude` (Anthropic SDK) so no real database or API calls are made. Individual tests override these mocks as needed.

**Test helpers (`tests/helpers/db.ts`):** `getMockedPrisma()` for type-safe mock access, `createTestAgent()`/`createTestTemplate()` factories, `createRequest()` for route handler testing, `parseResponse<T>()` for response extraction, `cleanupDb()` to reset all mocks.

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
- `tests/api/` — Route handler tests (agents, deploy, chat, teams, Letta memory/archival, MCP servers)
- `tests/lib/` — Library module tests (export, validation, slug, Letta translate/memory/skills/teams)
- `tests/runtime/` — Engine, tools, guardrails, MCP client, MCP presets, prompt builder
- `tests/stores/` — Zustand store tests (workspace 22, chat 33, memory 22)
- `tests/flows/` — Integration flows (deploy+chat, redeployment, pause/resume, multi-agent, guardrails, sessions)
- `tests/e2e/` — Playwright specs (agent-list, builder, deploy, new-agent, public-chat, teams)

E2E tests use Playwright targeting Chromium against `http://localhost:3000`. E2E helpers in `tests/e2e/helpers.ts` provide `createDeployableAgent()` and `deleteAgent()`.

## Path Alias

`@/*` maps to `./src/*` (configured in both `tsconfig.json` and `vitest.config.ts`).

## Key Gotchas

- **Next.js 16 route params are Promises:** Dynamic route handlers must `await params` before accessing `.id`, `.stage`, etc.
- **Slug uniqueness:** Generated via `generateSlug(name) + "-" + Date.now().toString(36)` — the base36 timestamp prevents collisions.
- **PATCH config merges, not replaces:** Partial config updates are merged with existing config. Stage config updates (via `/api/agents/[id]/stages/[stage]`) replace the entire section.
- **Prompt architecture:** `BASE_SYSTEM_PROMPT` is the builder persona (guides the user). `TEST_SYSTEM_PROMPT` flips to the agent persona (role-plays as the built agent). These are distinct — don't mix them.
- **Field name mappings:** The `/api/chat` route injects stage-specific valid field names into the system prompt so Claude knows which `previewUpdates` fields are valid for the current stage.
- **Letta is optional:** All Letta functions guard with `isLettaEnabled()`. The app runs without Docker/Letta — agents just use the Claude engine instead.
- **Letta SDK uses snake_case:** `agent_id`, `memory_blocks`, `read_only`, `created_at`. The Letta proxy routes map to camelCase for the frontend.
- **`lettaClient` is nullable:** After the `isLettaEnabled()` guard, use `lettaClient!` (non-null assertion) to access methods.
- **Shared memory blocks are Letta-side:** Block IDs are stored in `TeamProject.lettaBlockIds` as JSON. The blocks themselves live in Letta's database, not SQLite.
- **vi.hoisted() TDZ bug:** Do NOT destructure from `vi.hoisted()` when mocking `@/lib/letta/client` in tests. Use inline `vi.fn()` in `vi.mock()` factories and cast imports instead.

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

`docs/agent-os-overview.html` — Standalone HTML documentation with architecture diagrams, memory model, API reference, frontend components, execution phases, test coverage, and decision log. Styled with Autonomous brand design system.
