# GOALS.md

## Vision

Agent OS exists to make AI agents **useful teammates** — not disposable chat sessions. The core belief is that AI agents should accumulate knowledge over time, collaborate with each other, and become more valuable the longer you work with them.

## What We're Building

A platform where anyone can build, deploy, and orchestrate AI agent teams with persistent, self-editing memory. Agents remember what they learn, share context with their teammates, and connect to real tools to get real work done.

## Core Goals

### 1. Agents That Remember

Every interaction should make the agent better. Agents autonomously categorize what they learn — project facts go to shared memory, user preferences go to their persona, craft knowledge goes to long-term archival storage. No manual memory management required.

- Self-editing memory through Letta (MemGPT)
- Three memory scopes: global (per agent), project (shared across team), session (per conversation)
- Memory persists across sessions, projects, and deployments

### 2. Multi-Agent Teams That Collaborate

Complex work requires specialists. A design agent, a frontend engineer, a copywriter — each with deep expertise, sharing a common understanding of the project through shared memory blocks.

- Shared memory blocks for project context, decisions, task boards, and brand knowledge
- Team coordination without manual context passing
- Agents that build on each other's work

### 3. Guided Agent Creation

Building an agent shouldn't require prompt engineering expertise. A conversational 6-stage builder walks you through defining mission, identity, capabilities, memory, triggers, and guardrails — with AI assistance at every step.

- Conversational builder that infers configuration from natural language descriptions
- Stage-by-stage refinement with preview and testing
- Templates for common agent archetypes

### 4. Real Tool Integration

Agents that can only chat are limited. Through MCP (Model Context Protocol), agents connect to filesystems, git repos, browsers, Jira, Vercel, and any custom tool server — with sandboxed execution and full audit trails.

- Pre-configured MCP server presets for common tools
- Sandboxed execution with configurable timeouts and network policies
- Complete tool execution logging for observability

### 5. One-Click Deploy

Going from configured agent to live, shareable endpoint should be instant. Deploy creates a public URL with a snapshot of the agent's configuration and memory state.

- Public URLs for deployed agents
- Configuration snapshots at deploy time for reproducibility
- Pause, resume, and redeploy without losing state

### 6. Open and Portable

No vendor lock-in. Export agent configurations as provider-agnostic Markdown and YAML. The Letta integration is optional — the platform works standalone with Claude. The entire system runs locally with Docker Compose.

- Provider-agnostic export format
- Hybrid runtime: Letta for persistent memory, Claude for stateless fallback
- Self-hostable with minimal infrastructure (SQLite + Docker)

### 7. Run Anywhere with Persistent Memory

Agents built in Agent OS should run natively in any MCP-compatible environment — Claude Code, Cursor, Windsurf, custom SDKs — with the same persistent memory. Agent OS owns the identity and memory. The runtime owns the execution.

- Claude Code integration via MCP server + generated subagent definitions
- Same Letta memory accessible from any runtime that speaks MCP
- Server-side memory extraction ensures memory updates even when the runtime doesn't call tools
- One-click team export: subagent `.md` files, MCP config, hooks, and team context
- Agents refine in Agent OS, deploy to Claude Code, sync memory automatically

## What Success Looks Like

- A developer builds an agent team for a project, and after two weeks of working together, the agents anticipate patterns, remember decisions, and produce better output than day one.
- A non-technical user creates and deploys a specialized agent through the conversational builder without writing a single prompt template.
- A team of agents coordinates on a complex project — a designer, engineer, and strategist — sharing context automatically through shared memory, each getting better at their role over time.
- A developer exports their Agent OS team to Claude Code, works on a project for a week, and when they check back in Agent OS, the agents' memory reflects everything learned — decisions made, patterns discovered, user preferences observed.

## Non-Goals

- **Not a general-purpose chatbot.** This is a workspace for building and deploying purpose-built agents.
- **Not an agent marketplace.** The focus is on building your own agents, not consuming pre-built ones.
- **Not a workflow automation tool.** Agents are conversational collaborators, not rigid pipelines.
