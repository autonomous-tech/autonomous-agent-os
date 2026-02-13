# Agent OS + Website Team — Execution Plan

**For execution in Claude Code with Claude 4.6 Opus**

---

## Context

We're building two things in parallel:

1. **Infrastructure** — Memory layer, agent runtime, skill framework
2. **Website** — Rebuild autonomoustech.ca using the agents we're building

The work is done by agents, not humans. Human (Riz) provides direction, reviews, approves.

---

## What We're Building

### The Agent: Website Designer-Developer

A single deep agent that can:
- Design web pages (using Claude's native UI/frontend skills and the front-end design skill)
- Generate Next.js + PayloadCMS code
- Deploy to Vercel
- Learn preferences and remember decisions (memory)
- Follow brand guidelines (skills)

### The Infrastructure

| Component | Purpose |
|-----------|---------|
| **Memory Layer** | Graph-based (Graphiti), stores decisions, preferences, project state  -> Download the repository locally for reference: https://github.com/getzep/graphiti
| **Skill Framework** | Load skills (brand guide, design patterns) into agent context |
| **Agent Runtime** | Execute agent, handle tools, manage conversation |
| **Observability** | Trace all actions, enable evals and debugging |

---

## Architecture

```
Skills (static)              Memory (dynamic)
├── brand-guide              ├── preferences
├── frontend-design          ├── past decisions
├── seo-patterns             ├── project state
└── payload-cms              └── feedback history
         ↓                            ↓
    ┌─────────────────────────────────────┐
    │            AGENT RUNTIME             │
    │                                      │
    │  Agent + Skills + Memory + Tools     │
    │                                      │
    └─────────────────────────────────────┘
                      ↓
         ┌───────────────────────┐
         │        TOOLS          │
         ├───────────────────────┤
         │ - Code generation     │
         │ - PayloadCMS API      │
         │ - Vercel API          │
         │ - File system         │
         └───────────────────────┘
                      ↓
              Observable traces
```

---

## Phase 1: Foundation

Execute these tasks in parallel:

### Task 1.1: Graphiti Research & Setup

**Objective:** Understand Graphiti, set up memory layer foundation

**Actions:**
1. Clone and explore Graphiti repo: https://github.com/getzep/graphiti
2. Understand the data model (entities, relationships, temporal)
3. Set up a local instance
4. Create schema for website project:
   - Entities: Project, Brand, Page, Section, Decision, Preference
   - Relationships: project→pages, page→sections, decision→affects
5. Test basic operations: store, retrieve, query
6. Document findings and setup instructions

**Output:** 
- Working Graphiti instance
- Schema definition
- Setup documentation
- Assessment: is Graphiti right, or do we need alternative?

---

### Task 1.2: Agent Memory Patterns Research

**Objective:** Understand SOTA for agent memory

**Actions:**
1. Research MemGPT/Letta architecture (self-managing memory)
2. Research how memory consolidation works (episodic → semantic)
3. Research preference learning (how to learn from corrections)
4. Research context management (what fits in context vs retrieved)
5. Document patterns we should adopt

**Output:**
- Research summary
- Recommended patterns for our use case
- Architecture decisions

---

### Task 1.3: Skill Framework Implementation

**Objective:** Simple skill loading system

**Actions:**
1. Define skill format (use SKILL.md convention):
   ```
   skills/
   ├── brand-guide/
   │   └── SKILL.md
   ├── frontend-design/
   │   └── SKILL.md
   └── payload-cms/
       └── SKILL.md
   ```
2. Write brand-guide skill (from existing Autonomous brand guide)
3. Write frontend-design skill (layout patterns, component patterns)
4. Write payload-cms skill (schema patterns, API usage)
5. Implement skill loader (reads skills, formats for context injection)

**Output:**
- 3 complete skills
- Skill loader code
- Documentation

---

### Task 1.4: Agent Runtime v0

**Objective:** Basic agent that can run with skills and tools

**Actions:**
1. Set up project structure (Next.js or standalone Node?)
2. Implement agent core:
   - Load system prompt
   - Inject skills
   - Handle conversation
   - Call tools
3. Implement tools:
   - Code generation (file write)
   - Vercel deployment (API)
   - Memory read/write (once Task 1.1 complete)
4. Basic observability (log all LLM calls, tool calls)

**Output:**
- Working agent runtime
- Tool implementations
- Trace logging

---

### Task 1.5: Website Requirements & Architecture

**Objective:** Define what we're building

**Actions:**
1. Audit current autonomoustech.ca — what works, what doesn't
2. Define site architecture:
   - Pages needed
   - Navigation structure
   - Content types
3. Define design direction:
   - Reference sites
   - Mood/feel
   - Key differentiators
4. Write homepage brief:
   - Sections needed
   - Key messages
   - CTAs
5. Create content inventory — what content exists, what's needed

**Output:**
- Site architecture document
- Homepage brief
- Content inventory
- Design direction

---

## Phase 2: Integration

After Phase 1 tasks complete, integrate:

### Task 2.1: Memory + Runtime Integration

**Objective:** Agent uses memory layer

**Actions:**
1. Connect agent runtime to Graphiti
2. Implement memory operations:
   - Store decision when agent makes choice
   - Store preference when human gives feedback
   - Retrieve relevant context before generation
3. Test memory persistence across sessions

**Output:**
- Agent with working memory
- Memory persists and influences behavior

---

### Task 2.2: Homepage Generation v1

**Objective:** Generate first version of homepage

**Actions:**
1. Agent receives homepage brief (from Task 1.5)
2. Agent loads skills (brand guide, frontend design)
3. Agent designs homepage structure
4. Agent generates Next.js + PayloadCMS code
5. Deploy preview to Vercel
6. Collect feedback

**Output:**
- Homepage preview live on Vercel
- Feedback documented
- Learnings captured in memory

---

### Task 2.3: Iteration Loop

**Objective:** Improve based on feedback

**Actions:**
1. Human reviews homepage v1
2. Provides specific feedback
3. Agent stores feedback as preferences in memory
4. Agent generates homepage v2
5. Repeat until approved

**Output:**
- Approved homepage
- Memory populated with preferences
- Pattern for iteration established

---

## Phase 3: Expand

Parallel generation of remaining pages:

### Task 3.1: About Page
### Task 3.2: Services Pages  
### Task 3.3: Case Studies
### Task 3.4: Contact Page

Each follows same pattern:
1. Brief provided
2. Agent generates using skills + learned preferences
3. Review and iterate
4. Approve and merge

---

## Phase 4: Polish & Launch

### Task 4.1: Full Site QA
### Task 4.2: Performance Optimization
### Task 4.3: SEO Implementation
### Task 4.4: Production Deployment

---

## Repository Structure

### Repo 1: Agent Platform (Django)

```
autonomous-agent-os/
├── CLAUDE.md                    # Context for Claude Code
├── README.md
├── pyproject.toml               # Python dependencies (uv/poetry)
├── docker-compose.yml           # Local dev
├── Dockerfile                   # Production build
├── .env.example
│
├── config/                      # Django settings (Cookiecutter style)
│   ├── settings/
│   │   ├── base.py
│   │   ├── local.py
│   │   └── production.py
│   ├── urls.py
│   └── celery.py
│
├── skills/                      # Skill definitions (loaded by agents)
│   ├── brand_guide/
│   │   └── SKILL.md
│   ├── frontend_design/
│   │   └── SKILL.md
│   └── payload_cms/
│       └── SKILL.md
│
├── apps/
│   ├── agents/                  # Agent runtime
│   │   ├── models.py            # Agent, Conversation, Message
│   │   ├── services/
│   │   │   ├── runtime.py       # Agent execution
│   │   │   ├── skills.py        # Skill loader
│   │   │   └── llm.py           # Claude integration
│   │   ├── tasks.py             # Celery tasks
│   │   ├── api/
│   │   │   ├── views.py
│   │   │   └── serializers.py
│   │   └── admin.py
│   │
│   ├── memory/                  # Graphiti integration
│   │   ├── models.py            # Local cache/index
│   │   ├── services/
│   │   │   ├── client.py        # Graphiti client
│   │   │   ├── schema.py        # Entity definitions
│   │   │   └── operations.py    # Store/retrieve/query
│   │   └── admin.py
│   │
│   ├── tools/                   # Tool implementations
│   │   ├── services/
│   │   │   ├── code_gen.py      # Code generation
│   │   │   ├── vercel.py        # Vercel deploy
│   │   │   ├── filesystem.py    # File operations
│   │   │   └── payload.py       # PayloadCMS API
│   │   └── registry.py          # Tool registration
│   │
│   ├── projects/                # Website projects
│   │   ├── models.py            # Project, Page, Artifact
│   │   ├── api/
│   │   └── admin.py
│   │
│   └── observability/           # Tracing & evals
│       ├── models.py            # Trace, Eval
│       ├── services/
│       │   ├── traces.py
│       │   └── evals.py
│       └── admin.py
│
├── tests/
│   ├── agents/
│   ├── memory/
│   └── tools/
│
└── docs/
    ├── architecture.md
    └── decisions/               # ADRs
```

### Repo 2: Generated Website (Separate)

```
autonomoustech-website/
├── README.md
├── package.json
├── next.config.js
│
├── src/
│   ├── app/                     # Next.js App Router
│   ├── components/
│   └── lib/
│
├── payload/                     # PayloadCMS
│   ├── collections/
│   └── payload.config.ts
│
└── public/
```

---

## Stack Decisions

This is shared infrastructure — Riz, Abdullah, and team will all use it.

### Two Separate Repos

```
Repo 1: AGENT PLATFORM              Repo 2: WEBSITE OUTPUT
autonomous-agent-os                  autonomoustech-website
├── Django + Celery                  ├── Next.js 15
├── Postgres + Redis                 ├── PayloadCMS 3
├── Graphiti (memory)                ├── Tailwind + shadcn
├── Docker                           └── (generated by agents)
└── Self-hosted cloud
                                     Deployed: Vercel
Deployed: Autonomous cloud
(95.217.9.162 or similar)
```

### Agent Platform Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Language** | Python 3.12 | Team expertise, AI/LLM ecosystem |
| **Framework** | Django 5 (Cookiecutter Django) | Team knows it, production-ready |
| **API** | Django REST Framework or Django Ninja | Fast, typed |
| **Async/Workers** | Celery + Redis | Long-running agent tasks |
| **Database** | Postgres 16 | Standard, reliable |
| **ORM** | Django ORM | Built-in, team knows it |

### Memory Layer

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Graph DB** | Graphiti (pending spike) | Python-native, built for agent memory |
| **Fallback** | Neo4j or Postgres + Apache AGE | If Graphiti doesn't work out |
| **Vector Embeddings** | OpenAI or Voyage | For semantic retrieval |
| **Cache** | Redis | Already using for Celery |

### LLM Integration

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **LLM** | Anthropic Claude | Opus for complex, Sonnet for fast |
| **SDK** | anthropic (Python SDK) | Python-first, excellent |
| **Orchestration** | LangGraph (optional) | If multi-agent gets complex |

### Containerization

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Dev** | Docker Compose | Local dev with all services |
| **Prod** | Docker | Single deployable container (or compose) |
| **Base Image** | python:3.12-slim | Standard |

### Deployment

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Platform** | Self-hosted (Autonomous cloud) | Own infrastructure |
| **Reverse Proxy** | Caddy or Nginx | HTTPS, routing |
| **Process Manager** | Docker Compose or systemd | Service management |

### Dev & CI/CD

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Repo** | GitHub (autonomous-tech org) | Existing org |
| **CI** | GitHub Actions | Standard |
| **Testing** | pytest + pytest-django | Python standard |
| **Linting** | ruff | Fast Python linter |
| **Formatting** | black + isort | Standard |
| **Pre-commit** | pre-commit hooks | Quality gates |
| **Type Checking** | mypy or pyright | Optional but good |

### Observability

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Tracing** | Langfuse (self-hosted) or custom | LLM observability |
| **Logging** | structlog → Postgres | Queryable traces |
| **Error tracking** | Sentry | Already using |
| **Monitoring** | Prometheus + Grafana (optional) | If needed |

### Website Output (Separate Repo)

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Framework** | Next.js 15 | Team standard |
| **CMS** | PayloadCMS 3 | Already using, great API |
| **Styling** | Tailwind CSS | Team standard |
| **Components** | shadcn/ui | Team standard |
| **Deployment** | Vercel | Simple, preview deploys |

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Memory system | Graphiti (pending spike) | Graph-based, temporal, built for this |
| Skill format | SKILL.md (Clawdbot convention) | Standard, simple, proven |
| Agent runtime | Custom (not Agent OS builder) | Need full control for v1 |
| Website stack | Next.js + PayloadCMS | Already using, team knows it |
| Deployment | Vercel | Simple, preview deploys |

---

## Start Here

1. **Read this document fully**
2. **Start with Task 1.1 (Graphiti) and Task 1.5 (Website Requirements) in parallel**
3. **Report progress, ask for review at checkpoints**
4. **Human will provide feedback at each phase boundary**

---

## Context Files

These files provide additional context:

- `/home/rizki/clawd/memory/agent-os-planning.md` — Initial planning notes
- `/home/rizki/clawd/memory/agent-os-architecture.md` — Full architecture doc
- `/home/rizki/clawd/skills/autonomous-brand-guide/SKILL.md` — Existing brand guide skill

---

## Working Style

- Execute tasks fully, don't stop partway
- Create files, write code, make things real
- When blocked, document the blocker and move to parallel task
- At phase boundaries, summarize progress and ask for human review
- Store decisions and rationale in docs/decisions/
