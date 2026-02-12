# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Agent OS is an internal tool that guides technical builders through creating AI agent configurations via a conversational 6-stage process. Users describe an agent in one sentence, then a split-pane builder (chat + live preview) progressively builds a structured configuration package exported as a ZIP of Markdown/YAML files.

## Commands

```bash
# Development
npm run dev                          # Next.js dev server on http://localhost:3000

# Testing
npm test                             # Run all Vitest unit/integration tests
npm run test:watch                   # Vitest in watch mode
npx vitest run tests/api/agents.test.ts  # Run a single test file
npm run test:e2e                     # Playwright E2E tests (auto-starts dev server)
npm run test:coverage                # Vitest with coverage

# Build & Lint
npm run build                        # Production build
npm run lint                         # ESLint

# Database
npx prisma migrate dev               # Run migrations
npx prisma generate                  # Regenerate Prisma client
npx prisma db seed                   # Seed 3 starter templates
```

## Architecture

**Stack:** Next.js 16 (App Router) + React 19 + TailwindCSS 4 + Shadcn/ui + Prisma 7 + SQLite + Anthropic Claude API

### Data Layer

Two Prisma models (`prisma/schema.prisma`): `AgentProject` and `AgentTemplate`. SQLite has no native JSON type, so `config`, `stages`, and `conversations` are stored as JSON strings in `String` columns. The API layer handles `JSON.parse`/`JSON.stringify` at the boundary. TypeScript interfaces in `src/lib/types.ts` provide type safety over the raw JSON.

The Prisma client (`src/lib/db.ts`) uses `@prisma/adapter-better-sqlite3` with a dev-mode global singleton pattern. Generated client output goes to `src/generated/prisma/client`.

**Template shape mismatch:** Templates use flat arrays for capabilities/triggers, while `AgentConfig` uses nested objects. Helper functions `getTools()` and `getTriggers()` in `src/lib/types.ts` bridge this gap — always use them instead of accessing these fields directly.

### API Routes (`src/app/api/`)

All API routes are Next.js App Router route handlers. Key patterns:
- **Input validation** on all endpoints: field type checks, length limits (messages capped at 10k chars), allowlisted update fields on PATCH
- **PATCH `/api/agents/[id]`** rejects arrays for config/stages/conversations fields (must be objects)
- **`/api/chat`** is the core builder endpoint: takes `{ projectId, stage, message }`, builds a system prompt from `BASE_SYSTEM_PROMPT + STAGE_PROMPTS[stage]`, calls Claude, parses structured JSON response (`reply`, `previewUpdates[]`, `quickReplies[]`, `stageStatus`), updates the database, returns to frontend
- **`/api/test`** makes Claude role-play as the agent being built using its current config
- **`/api/export`** runs validation then generates a ZIP with 13 files (agent.yaml, agent.md, personality/, capabilities/, memory/, operations/, etc.)

### Claude Integration (`src/lib/claude.ts`)

Two exported functions: `chat()` and `inferFromDescription()`. Uses `claude-sonnet-4-5-20250929` with 2048 max tokens. System prompts are in `src/lib/prompts/index.ts`. `inferFromDescription()` has a fallback that returns a minimal config if Claude's JSON response is malformed. Both functions strip markdown code fences from Claude's response before parsing JSON.

### Frontend

Three pages: `/` (agent list), `/agents/new` (create), `/agents/[id]` (builder). The builder is a 3-pane layout:
- **Sidebar** (`src/components/builder/Sidebar.tsx`): stage navigation with status indicators
- **ChatPane** (`src/components/builder/ChatPane.tsx`): conversational interface posting to `/api/chat`
- **PreviewPane** (`src/components/builder/PreviewPane.tsx`): live config preview with inline editing and test sandbox

State is managed with React hooks; config changes sync to the backend via PATCH requests.

### 6-Stage Builder Model

Stages flow: Mission → Identity → Capabilities → Memory → Triggers → Guardrails. Each stage has status: `"incomplete"` → `"draft"` → `"approved"`. Stage-specific system prompts guide Claude to collect the right information at each step.

**Project status workflow:** `"draft"` → `"building"` (set on first chat interaction) → `"exported"` (set after ZIP generation). Conversation history is capped at 40 messages (20 turns) per stage to prevent unbounded growth.

### Export & Validation (`src/lib/export.ts`)

`validateAgent()` produces structural errors (block export) and completeness/consistency warnings (non-blocking). The ZIP export generates provider-agnostic Markdown + YAML files.

## Testing

Tests are in `tests/`. Vitest setup (`tests/setup.ts`) globally mocks `@/lib/db` (Prisma) and `@/lib/claude` (Anthropic SDK) so no real database or API calls are made. Individual tests override these mocks as needed. Test fixtures are in `tests/helpers/fixtures.ts`.

Test helpers in `tests/helpers/db.ts` provide: `getMockedPrisma()` for type-safe mock access, `createTestAgent()`/`createTestTemplate()` factories that wire up mock returns, `createRequest()` to build Request objects for route handler testing, and `parseResponse<T>()` to extract status + typed JSON from Response objects.

E2E tests use Playwright targeting Chromium against `http://localhost:3000`.

## Path Alias

`@/*` maps to `./src/*` (configured in both `tsconfig.json` and `vitest.config.ts`).

## Key Gotchas

- **Next.js 16 route params are Promises:** Dynamic route handlers must `await params` before accessing `.id`, `.stage`, etc.
- **Slug uniqueness:** Generated via `generateSlug(name) + "-" + Date.now().toString(36)` — the base36 timestamp prevents collisions.
- **PATCH config merges, not replaces:** Partial config updates are merged with existing config. Stage config updates (via `/api/agents/[id]/stages/[stage]`) replace the entire section.
- **Prompt architecture:** `BASE_SYSTEM_PROMPT` is the builder persona (guides the user). `TEST_SYSTEM_PROMPT` flips to the agent persona (role-plays as the built agent). These are distinct — don't mix them.
- **Field name mappings:** The `/api/chat` route injects stage-specific valid field names into the system prompt so Claude knows which `previewUpdates` fields are valid for the current stage.

## Environment Variables

Copy `.env.sample` → `.env`. Required: `DATABASE_URL` (defaults to `file:./dev.db`) and `ANTHROPIC_API_KEY`.
