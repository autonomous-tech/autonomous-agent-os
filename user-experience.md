# Agent OS — UX Principles

A living reference for designers and developers working on Agent OS. These principles govern how the product should feel, behave, and communicate. Check against them when making UX decisions.

---

## 1. Product Goal

**"Create amazing agents easily, improve them, observe them."**

Agent OS exists to make agent creation accessible to technical builders who understand what they want but should not need to wrestle with YAML files or JSON schemas to get there. The product translates intent into structured configuration through conversation, not through forms.

- The primary output is a complete agent configuration package (Markdown + YAML), exported as a ZIP.
- The primary experience is a guided, conversational builder — not a dashboard full of settings.
- Success means a user can go from a one-sentence description to a fully configured agent without ever feeling lost or overwhelmed.

---

## 2. Guide, Don't Interrogate

The experience should feel like working with a knowledgeable colleague, not filling out an intake form.

- **Suggest rather than ask.** Instead of "What tone should your agent use?", say "I'd suggest a professional tone for a customer-facing agent — does that work?"
- **Provide smart defaults rather than empty fields.** Every configurable option should have a reasonable starting value.
- **Every question comes with a recommendation.** The builder always has an opinion. Users can override it, but they should never face a blank slate.
- **Respect deference.** If the user defers on a question twice (e.g., "I'm not sure", "whatever you think"), commit to defaults and move on. Do not ask a third time.
- **Bias toward momentum.** The goal is forward progress. A good-enough answer now beats a perfect answer that stalls the flow.

---

## 3. Cognitive Load Management

Reduce the number of things a user needs to hold in their head at any given moment.

- **One decision at a time.** Each message from the builder should focus on a single topic or choice.
- **Maximum 3 choices per question.** When presenting options, cap them at three. If more exist, curate the most likely ones and offer "or something else" as an escape hatch.
- **Smart defaults for everything.** No field should require the user to research an answer. Defaults should be good enough to ship.
- **"I don't know" is always valid.** The builder must gracefully handle uncertainty. Treat it as a signal to use defaults, not as an error.
- **Archetype-based starting points.** Reduce cold-start anxiety by letting users pick an agent archetype (customer support, research assistant, etc.) before diving into specifics.
- **Never show all 6 stages at once.** The sidebar shows stage names and status, but detailed configuration for each stage is only visible when that stage is active.

---

## 4. Progressive Disclosure

Information and complexity should reveal themselves at the pace of the user's progress, not all at once.

- **Show only what is relevant now.** Stage-specific prompts, fields, and options appear only when the user reaches that stage.
- **Preview pane reflects completion.** Configured sections are shown prominently with full detail. Unconfigured sections are shown minimally — a title and a "not yet configured" indicator, not a wall of empty fields.
- **Stage navigation provides orientation without overwhelm.** Users can see the full picture (all 6 stages, their status) in the sidebar without being forced to engage with stages they have not reached.
- **Details expand on demand.** Tool configurations, trigger settings, and memory parameters are collapsed by default. Users drill in when they are ready.

---

## 5. Reassurance Patterns

Users making dozens of decisions in sequence need constant signals that they are not making irreversible mistakes.

- **"You can change this later" appears everywhere.** Attach this message to any decision that feels significant — naming, tone, capability selection.
- **Nothing is permanent until export.** The builder should make this clear early and reinforce it throughout. The entire configuration is mutable at every point before export.
- **Every choice is a starting point.** The builder explicitly frames decisions as defaults that can be refined, not commitments.
- **Quick replies suggest next steps.** After every builder message, provide 2-3 quick reply options so users never stare at a blank input wondering what to do next.
- **Real-time preview provides immediate feedback.** When the user makes a choice in chat, the preview pane updates instantly. This closes the feedback loop and builds confidence that the system understood them correctly.

---

## 6. Field-Type-Aware Rendering

Different data types deserve different visual treatments in the preview pane. Rendering should match the mental model of the data, not force everything into the same text-field pattern.

| Data Type | Display Treatment | Edit Treatment |
|---|---|---|
| **Text / descriptions** | Left-bordered paragraph block | Inline textarea |
| **Lists** (tasks, rules, topics) | Styled bullet list | Add/remove items in edit mode |
| **Enums** (tone, strategy, defense level) | Horizontal pill/chip group | Click to select a different option |
| **Tools / capabilities** | Rich cards: name, color-coded access badge, description, expandable settings | Edit within expanded card |
| **Triggers** | Color-coded type badge + description + channel chips | Edit fields inline |
| **Booleans** (daily_logs, curated_memory) | Toggle switch | Direct toggle, no separate edit mode |
| **Quotes** (greeting message) | Speech-bubble styled blockquote | Inline textarea |
| **Key-value pairs** (resource limits) | "Label: value" rows | Inline value editing |

Consistency within each type matters more than consistency across types. A list should always look and behave like a list, regardless of which stage it appears in.

---

## 7. Visual Hierarchy

Direct attention to what matters. Tuck away what does not — but keep it accessible.

- **Agent identity is always visible.** The agent's name and identifier should be persistent in the UI, never scrolled off-screen or hidden behind navigation.
- **Status badges communicate progress.** Each stage shows its status (incomplete, draft, approved) via a clear visual indicator. Users should be able to glance at the sidebar and understand overall completion.
- **Collapsible sections let users focus.** In the preview pane, sections can be expanded or collapsed. Default state: the current stage is expanded, others are collapsed.
- **Color is used sparingly and meaningfully.** Reserve color coding for:
  - Access levels on tools/capabilities (e.g., read vs. write vs. admin)
  - Trigger types (e.g., scheduled vs. event-driven vs. manual)
  - Stage status indicators
  - Validation states (error vs. warning)
- **Typography establishes hierarchy.** Section headers, field labels, and field values should be visually distinct through size and weight, not just color.

---

## 8. Error Philosophy

Errors should prevent bad exports, not prevent exploration.

- **Errors block export, not exploration.** A user can have an incomplete or inconsistent agent configuration and still navigate freely, test the agent, and continue building. Export is the gate, not the builder itself.
- **Two error tiers at export time:**
  - **Structural errors (blocking):** Missing required fields, invalid configurations. These prevent export.
  - **Completeness/consistency warnings (non-blocking):** Suggestions for improvement, unused capabilities, mismatched settings. These are surfaced but do not block export.
- **Never say "you can't do that."** The builder should say "you'll need to add X before exporting" — framing the gap as a future action, not a current prohibition.
- **Testing tolerates incompleteness.** The test sandbox should work with whatever configuration exists, filling gaps with reasonable defaults so users can try out their agent at any point in the process.
- **Validation feedback is specific and actionable.** "Mission statement is required" is better than "Stage 1 is incomplete." Point to the exact field and, where possible, offer to fix it.

---

## 9. Conversation Design

The chat pane is the primary interaction surface. Its design determines whether the experience feels guided or tedious.

- **Quick replies reduce typing.** Offer clickable response options for common answers. Reserve free-text input for genuinely open-ended questions.
- **Messages are 2-3 sentences maximum.** The builder should be concise. Long messages get skimmed. If more detail is needed, split it across multiple messages or use expandable sections.
- **Smart defaults are embedded in the conversation.** Instead of asking and then suggesting, lead with the suggestion: "I'd suggest X — does that work?" rather than "What would you like for X?"
- **Reference previous decisions naturally.** The builder should maintain conversational context: "Since you chose a professional tone, I'd recommend a formal greeting like..." This makes the experience feel coherent rather than stage-by-stage.
- **Prefer binary questions over open-ended ones.** "Should this agent have access to email?" is easier to answer than "What communication channels should this agent use?" Open-ended questions are appropriate for descriptions and naming, not for capability selection.
- **Cap conversation history.** Keep per-stage conversation history bounded (40 messages / 20 turns) to maintain context quality and performance.

---

## 10. Creation Flow Philosophy

The first minute of the experience determines whether users engage or abandon. The creation flow should build momentum, not front-load complexity.

- **Progressive scope revelation.** Users should discover the breadth of what they are building gradually:
  1. Start with archetype selection — what kind of agent is this?
  2. Then audience — who will use it?
  3. Then naming — make it feel real.
  4. Then dive into stage-by-stage configuration.
- **Templates as a fast path.** For users who want to skip the guided flow, templates provide a pre-configured starting point that can be customized. Templates are an alternative entry point, not a replacement for the guided experience.
- **Free-text description for experienced users.** Users who know exactly what they want can describe their agent in a sentence and let the system infer a starting configuration. This path skips archetype selection but still enters the stage-by-stage builder for refinement.
- **Every path converges on the same builder.** Whether users start from an archetype, a template, or a free-text description, they end up in the same 6-stage builder. The entry point varies; the building experience does not.

---

## Applying These Principles

When making a UX decision, check it against these questions:

1. Does this guide the user or interrogate them?
2. How many decisions is the user making at once?
3. Is this information relevant right now, or can it be revealed later?
4. Does the user know they can change this?
5. Is the visual treatment appropriate for this data type?
6. Does this error block exploration or just export?
7. Is this message concise enough for a chat interface?
8. Does this maintain momentum toward a completed agent?

If a design choice conflicts with these principles, the principles win unless there is a documented reason to deviate.
