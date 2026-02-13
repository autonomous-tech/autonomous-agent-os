# Agent OS Checkpoint — February 13, 2026

## Where We Are

Agent OS is a Next.js platform for building and working with AI agents. We built 5 phases of infrastructure:

- Letta (MemGPT) integration for persistent agent memory
- Workspace UI with chat, memory inspector, tool logs
- Team system with shared memory blocks
- MCP server presets (filesystem, git, browser, vercel)
- 519 passing tests, clean build, clean lint (0 errors)

**4 specialist agents exist** in the database — fully configured with identity, skills, tools, guardrails:
- Website Designer (agent_designer)
- Brand Strategist (agent_brand)
- Content Writer (agent_content)
- SEO Specialist (agent_seo)

All old demo agents have been deleted.

---

## What We're Doing Next

**One agent. Real work. Fix Agent OS as we go.**

Start with the **Website Designer** agent. Use it to build autonomoustech.ca. Every time the UX breaks or feels wrong, fix it. The website is the forcing function.

---

## The Website Designer Agent

### Current Config (in DB as agent_designer)

```
Name: Website Designer
Emoji: 🎨
Identity: "Designer" — Creative, detail-oriented, opinionated about good design
Tone: creative-professional
Tools: Filesystem (write), Git (write), Browser (read)
Skills: Frontend Design, Responsive Design
Guardrails: Use design tokens, responsive + accessible, semantic HTML, no deploy without review
```

### What It Needs To Actually Work

1. **A system prompt that's battle-tested** — The seed config is structural data. It needs to be turned into an actual system prompt that makes Claude behave like this agent. The existing builder's `BASE_SYSTEM_PROMPT` + stage prompts are for the config builder, not for a working agent.

2. **Skills loaded into context** — The brand-guide and frontend-design SKILL.md files need to be injected into the agent's system prompt or context window when chatting.

3. **Real tool access** — MCP filesystem/git/browser servers need to actually run and connect. Currently they're preset definitions but no MCP servers are running.

4. **A project brief** — The agent needs to know what it's building. See the Website Brief section below.

---

## The Website: autonomoustech.ca

### Current State
- WordPress + Divi theme
- Generic "digital consultancy" positioning
- Blue (#2ea3f2) + white color scheme
- Open Sans font
- Standard corporate structure

### What It Should Be
- Next.js 15 + Tailwind CSS + shadcn/ui (our standard stack)
- Dark-mode first (#0a0a0a background, #8b5cf6 purple accent)
- Inter + Fira Code fonts
- AI-native software company, not generic consultancy
- Hosted on Vercel, separate repo: `autonomous-tech/autonomoustech-website`

### Site Architecture

```
/                   Homepage (hero + services + differentiators + CTA)
/services           What we build (AI agents, platforms, websites)
/work               Case studies / portfolio
/about              Team, story, values
/contact            Contact form + booking link
```

### Homepage Brief

**Hero:** Bold statement about what Autonomous does. Not "digital consultancy" — more like "We build AI that works." Dark background, large Inter Bold heading, subtle gradient or animation. Single CTA.

**Services Section:** 3-4 cards showing what we actually do:
- AI Agent Development (custom agents, memory, tools)
- Platform Engineering (Next.js, Django, cloud infrastructure)
- Website Design & Development (modern, fast, accessible)
- Consulting & Strategy (technical advisory, architecture review)

**Differentiators:** Why Autonomous. Small team, senior engineers only, AI-native from day one, we use our own tools (Agent OS).

**Social Proof:** Client logos or project highlights. Keep it minimal.

**CTA:** "Let's build something." → Contact page or booking link.

### Design Direction
- Reference: vercel.com, linear.app, resend.com (dark, clean, technical)
- NOT: generic agency sites with stock photos and gradients
- Typography-driven. Let the words do the work.
- Animations: subtle, purposeful. No parallax or scroll-jacking.
- Mobile-first responsive

---

## How To Use Agent OS For This

### Step 1: Make the Designer Agent Actually Chat

The agent workspace (`/agents/agent_designer`) has a chat tab. Currently it uses the legacy Claude runtime (no Letta). That's fine for v1 — we don't need Letta memory to start.

**What needs to happen:**
- The chat needs to use the agent's own system prompt (built from its config + skills), not the builder's system prompt
- Skills (brand-guide, frontend-design SKILL.md) need to be injected into context
- The agent should respond as "Designer", not as the builder assistant

**Where to fix this:**
- `src/app/api/runtime/[slug]/chat/route.ts` — The runtime chat endpoint. Currently only works for deployed agents with a slug. Need to also support chatting with agents by ID in the workspace.
- `src/lib/runtime/prompt.ts` — Builds the runtime system prompt from agent config. This is where skills get injected.
- `src/components/workspace/chat/ChatPanel.tsx` — The workspace chat UI. Currently tries Letta first, falls back to legacy `/api/chat` (builder chat). Needs a third path: runtime chat with agent's own persona.

### Step 2: Give It the Brief

Once the agent chats as itself, give it the homepage brief (above). Have a conversation:
- "Here's what we're building: [brief]"
- "Design the homepage structure — what sections, what layout"
- "Generate the Next.js code for the hero section"

### Step 3: Where the Output Goes

The agent should produce code. For now, it can output code in chat (like any Claude conversation). Later:
- Artifacts panel in the workspace (placeholder exists)
- Direct file write via MCP filesystem tool
- Git commits via MCP git tool

For v1, copy the code out of chat into the `autonomoustech-website` repo manually.

### Step 4: Fix What Breaks

Every friction point is an Agent OS improvement:

| Friction | Fix |
|----------|-----|
| Chat doesn't use agent's persona | Wire workspace chat to runtime prompt builder |
| No skills in context | Load SKILL.md files into system prompt |
| Can't see what agent "remembers" | Memory panel (exists, needs Letta) |
| Agent output is just text | Build artifacts panel with code blocks + copy button |
| No tool execution | Stand up MCP servers, wire to runtime |
| Can't iterate on designs | Add revision history / version comparison |

---

## Files That Matter

### Agent Config & Runtime
- `prisma/seed.ts` — Agent definitions (designerConfig, brandConfig, etc.)
- `src/lib/runtime/prompt.ts` — Builds system prompt from agent config
- `src/lib/runtime/engine.ts` — Runtime engine (handles tool loop)
- `src/app/api/runtime/[slug]/chat/route.ts` — Runtime chat endpoint
- `src/components/workspace/chat/ChatPanel.tsx` — Workspace chat UI

### Skills
- `skills/brand-guide/SKILL.md` — Brand colors, typography, voice, components
- `skills/frontend-design/SKILL.md` — Next.js/React/Tailwind patterns
- `skills/payload-cms/SKILL.md` — PayloadCMS patterns (may not need for v1)

### Workspace UI
- `src/app/agents/[id]/page.tsx` — Agent workspace page (builder + workspace modes)
- `src/components/workspace/WorkspaceLayout.tsx` — Tabbed workspace layout
- `src/components/workspace/chat/ChatPanel.tsx` — Chat with streaming
- `src/components/workspace/memory/MemoryPanel.tsx` — Memory inspector
- `src/components/workspace/tools/ToolLogPanel.tsx` — Tool execution log

### Letta Integration (for later)
- `src/lib/letta/client.ts` — Letta SDK singleton
- `src/lib/letta/memory.ts` — Shared memory blocks
- `src/lib/letta/skills.ts` — Load skills to archival memory
- `src/lib/letta/teams.ts` — Team deployment + project memory
- `docker-compose.yml` — Letta server (needs to be created)

### Stores
- `src/stores/workspace-store.ts` — Active agent, tab, sidebar state
- `src/stores/chat-store.ts` — Messages, streaming, tool calls
- `src/stores/memory-store.ts` — Memory blocks, archival search

---

## Commands

```bash
npm run dev                    # Start dev server on :3000
npm test                       # 519 tests, all passing
npm run build                  # Clean production build, 33 routes
npm run lint                   # 0 errors, 22 warnings (test files only)
npx prisma db seed             # Re-seed specialist agents
```

---

## Git State

Branch: `main`
Last commits:
- Fixed homepage 500 (server component onClick)
- Fixed all ESLint errors (236 → 0)
- Comprehensive HTML docs, updated CLAUDE.md
- Full Phase 1-5 implementation (Letta, workspace, teams, tests)

Uncommitted changes:
- Deleted old agents from DB (runtime, not in code)
- Various lint fixes from this session
- This checkpoint file

---

## Decision: Start Without Letta

Letta adds persistent memory across sessions, shared team blocks, and self-editing memory. But it requires Docker + Postgres + a running Letta server.

**For the first working session with the Designer agent, skip Letta.** Use the existing Claude runtime with the agent's config + skills injected as system prompt. This lets us:
1. Actually start working immediately
2. Test and improve the workspace UX
3. Produce real website output
4. Add Letta later when we need cross-session memory

The switch to Letta is designed to be transparent — the workspace chat already checks for `lettaAgentId` and falls back.

---

## Next Session: Do This

1. **Wire workspace chat to use agent's persona + skills** (not builder chat)
2. **Open Website Designer in workspace**
3. **Feed it the homepage brief**
4. **Iterate on the homepage design through conversation**
5. **Fix every UX issue encountered along the way**
6. **Capture agent output as the start of autonomoustech-website**
