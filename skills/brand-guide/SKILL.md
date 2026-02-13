---
type: skill
name: autonomous-brand-guide
version: 1.0.0
tags: [brand, design, autonomous, identity]
---

# Autonomous Brand Guide

This skill provides comprehensive brand guidelines for Autonomous, an AI-first software development platform. Use this guide to ensure all design, content, and UX decisions align with our brand identity.

## Brand Overview

Autonomous is a modern AI development platform that empowers technical builders to create sophisticated AI agents through conversation. We are:

- **AI-native**: Built by AI engineers, for AI engineers
- **Technical-first**: No abstraction theater — we embrace complexity
- **Open and transparent**: Opinionated but customizable
- **Modern and minimalist**: Dark-mode first, clean aesthetics

## Visual Identity

### Color Palette

#### Primary Colors
```css
--autonomous-black: #0a0a0a;        /* Primary background */
--autonomous-white: #fafafa;        /* Primary text on dark */
--autonomous-purple: #8b5cf6;       /* Primary brand color */
--autonomous-purple-dark: #6d28d9;  /* Hover states */
--autonomous-purple-light: #a78bfa; /* Accents */
```

#### Neutral Scale
```css
--gray-50: #fafafa;
--gray-100: #f4f4f5;
--gray-200: #e4e4e7;
--gray-300: #d4d4d8;
--gray-400: #a1a1aa;
--gray-500: #71717a;
--gray-600: #52525b;
--gray-700: #3f3f46;
--gray-800: #27272a;
--gray-900: #18181b;
--gray-950: #09090b;
```

#### Accent Colors
```css
--accent-blue: #3b82f6;      /* Information */
--accent-green: #10b981;     /* Success */
--accent-amber: #f59e0b;     /* Warning */
--accent-red: #ef4444;       /* Error/Danger */
```

### Typography

#### Font Stack
- **Headings**: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **Body**: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **Monospace**: `'Fira Code', 'JetBrains Mono', 'Menlo', 'Monaco', monospace`

#### Font Sizes (Tailwind Scale)
```
text-xs:   0.75rem   (12px)
text-sm:   0.875rem  (14px)
text-base: 1rem      (16px)
text-lg:   1.125rem  (18px)
text-xl:   1.25rem   (20px)
text-2xl:  1.5rem    (24px)
text-3xl:  1.875rem  (30px)
text-4xl:  2.25rem   (36px)
```

#### Font Weights
- Regular: 400 (body text, labels)
- Medium: 500 (buttons, emphasis)
- Semibold: 600 (headings, section titles)
- Bold: 700 (hero headings, CTAs)

### Spacing & Layout

Use Tailwind's 4px spacing scale. Common patterns:
- **Micro spacing**: `gap-1` (4px), `gap-2` (8px) — button icon padding, inline badges
- **Component padding**: `p-3` (12px), `p-4` (16px) — card interiors, form fields
- **Section margins**: `mb-6` (24px), `mb-8` (32px) — between major sections
- **Page margins**: `mt-12` (48px), `mt-16` (64px) — top-level layout

### Border Radius
- **Tight**: `rounded` (4px) — badges, inline elements
- **Default**: `rounded-md` (6px) — buttons, form fields
- **Relaxed**: `rounded-lg` (8px) — cards, panels
- **Smooth**: `rounded-xl` (12px) — modals, major containers

### Shadows
```css
/* Subtle lift */
shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05)

/* Default card */
shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)

/* Elevated panel */
shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)

/* Modal/Dropdown */
shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)
```

## Component Patterns

### Buttons

```tsx
// Primary CTA
<button className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-md transition-colors">
  Create Agent
</button>

// Secondary
<button className="bg-gray-800 hover:bg-gray-700 text-gray-100 font-medium px-4 py-2 rounded-md transition-colors border border-gray-700">
  Cancel
</button>

// Ghost
<button className="text-gray-400 hover:text-gray-100 hover:bg-gray-800 px-3 py-2 rounded-md transition-colors">
  Learn More
</button>
```

### Cards

```tsx
<div className="bg-gray-900 border border-gray-800 rounded-lg p-6 shadow-lg hover:border-gray-700 transition-colors">
  <h3 className="text-lg font-semibold text-gray-100 mb-2">Card Title</h3>
  <p className="text-gray-400 text-sm">Card description goes here.</p>
</div>
```

### Form Fields

```tsx
<div className="space-y-2">
  <label className="text-sm font-medium text-gray-300">
    Field Label
  </label>
  <input
    type="text"
    className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
    placeholder="Placeholder text"
  />
  <p className="text-xs text-gray-500">Helper text goes here.</p>
</div>
```

### Badges

```tsx
// Status badge
<span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-900/30 text-green-400 border border-green-800">
  Active
</span>

// Tag
<span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700">
  TypeScript
</span>
```

## Voice & Tone

### Writing Principles

1. **Be direct**: No marketing fluff. Say what you mean.
   - ✅ "Build AI agents through conversation"
   - ❌ "Leverage our revolutionary AI-powered platform to synergize..."

2. **Be technical**: Our audience is developers. Use precise language.
   - ✅ "Agent configs export as YAML + Markdown"
   - ❌ "Export your work in industry-standard formats"

3. **Be honest**: Acknowledge complexity. Don't hide trade-offs.
   - ✅ "Structured prompts are verbose but predictable"
   - ❌ "Our advanced system handles everything automatically"

4. **Be concise**: Respect the user's time.
   - ✅ "6-stage builder: Mission → Identity → Capabilities → Memory → Triggers → Guardrails"
   - ❌ "Our comprehensive six-stage onboarding process guides you through..."

### Content Patterns

#### Headings
- Use sentence case, not title case
- No terminal punctuation (no periods or colons)
- Keep under 8 words

```
✅ Configure agent memory
❌ Configure Agent Memory
❌ Configure Agent Memory:
```

#### Microcopy
- Button labels: Verb + noun (max 3 words)
  - ✅ "Export ZIP", "Create Agent", "Save Changes"
  - ❌ "Click here to export", "Create", "OK"

- Field labels: Nouns, no questions
  - ✅ "Agent name", "System prompt", "Trigger conditions"
  - ❌ "What should we call this agent?", "Name:"

- Error messages: State problem + solution
  - ✅ "Agent name is required. Please enter a name."
  - ❌ "Invalid input", "Error!"

## UI/UX Patterns

### Dark Mode First

All interfaces default to dark mode. Color choices:
- **Background layers**: `bg-black` → `bg-gray-950` → `bg-gray-900` → `bg-gray-800`
- **Text hierarchy**: `text-gray-100` (primary) → `text-gray-300` (secondary) → `text-gray-500` (tertiary)
- **Borders**: `border-gray-800` (default) → `border-gray-700` (hover/focus)

### Interaction States

Always provide visual feedback:
- **Hover**: Lighten background by 1 shade, or change border color
- **Focus**: 2px ring in brand purple (`ring-2 ring-purple-600`)
- **Active**: Slightly scale down (`active:scale-95`) for clickable elements
- **Disabled**: 50% opacity + no pointer events

### Loading States

```tsx
// Skeleton (prefer over spinners)
<div className="animate-pulse bg-gray-800 h-20 rounded-lg" />

// Inline spinner (when needed)
<svg className="animate-spin h-5 w-5 text-purple-600" />
```

### Empty States

Never show a blank screen. Provide context + action:

```tsx
<div className="text-center py-12">
  <p className="text-gray-400 mb-4">No agents yet</p>
  <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md">
    Create your first agent
  </button>
</div>
```

## Iconography

Use **Lucide Icons** exclusively. Stroke width: 2px.

Common icons:
- Actions: `Plus`, `Trash2`, `Edit3`, `Save`, `Download`
- Navigation: `ChevronRight`, `ChevronDown`, `ArrowLeft`, `Menu`
- Status: `CheckCircle2`, `AlertCircle`, `XCircle`, `Clock`
- Content: `File`, `Folder`, `Code`, `MessageSquare`

Size mapping:
- Small (16px): `size-4` — inline with text
- Default (20px): `size-5` — buttons, list items
- Large (24px): `size-6` — section headers, empty states

## Animation

Keep it subtle and purposeful.

### Transitions
```css
/* Default */
transition-colors duration-200

/* Hover lift */
transition-transform hover:-translate-y-0.5

/* Fade in */
transition-opacity duration-300
```

### Motion Principles
- **Fast**: 150-200ms for micro-interactions (hover, focus)
- **Medium**: 200-300ms for component state changes (expand/collapse)
- **Slow**: 300-500ms for page transitions (route changes)

Avoid:
- Animations longer than 500ms
- Bounce or elastic easing (too playful for our brand)
- Parallax or scroll-triggered effects (distracting)

## Code Display

When showing code samples or config outputs:

```tsx
<pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
  <code className="text-sm text-gray-300 font-mono">
    {codeString}
  </code>
</pre>
```

Syntax highlighting: Use VS Code Dark+ theme colors.

## Accessibility

- **Color contrast**: All text meets WCAG AA (4.5:1 minimum)
- **Focus indicators**: Always visible, 2px ring, high contrast
- **Keyboard navigation**: Full support, logical tab order
- **ARIA labels**: On icon-only buttons and interactive elements
- **Screen reader text**: Use `sr-only` for context that's visual-only

## Don'ts

❌ No gradients (except subtle radial backgrounds)
❌ No drop shadows on text
❌ No all-caps headings (except acronyms)
❌ No emoji in UI copy (docs/marketing only)
❌ No Comic Sans (obviously)
❌ No light mode toggle (dark only for now)

## Examples in the Wild

Reference these components from the codebase:
- `/src/components/builder/AgentCard.tsx` — Card pattern with hover states
- `/src/components/builder/PreviewPane.tsx` — Panel layout with tabs
- `/src/app/agents/[id]/page.tsx` — 3-column responsive layout

---

**Last Updated**: 2026-02-13
**Maintained By**: Autonomous Design Team
