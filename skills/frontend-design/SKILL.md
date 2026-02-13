---
type: skill
name: frontend-design-patterns
version: 1.0.0
tags: [frontend, nextjs, react, tailwind, patterns]
---

# Frontend Design Patterns

This skill provides comprehensive frontend development patterns for Next.js App Router applications using React 19, TypeScript, and Tailwind CSS 4.

## Project Structure

### Next.js 16 App Router Layout

```
src/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Home page
│   ├── agents/
│   │   ├── page.tsx            # List view
│   │   ├── new/
│   │   │   └── page.tsx        # Create flow
│   │   └── [id]/
│   │       └── page.tsx        # Dynamic detail page
│   └── api/
│       ├── agents/
│       │   ├── route.ts        # GET /api/agents, POST /api/agents
│       │   └── [id]/
│       │       ├── route.ts    # GET/PATCH/DELETE /api/agents/:id
│       │       └── stages/
│       │           └── [stage]/
│       │               └── route.ts
│       ├── chat/
│       │   └── route.ts        # POST /api/chat (builder conversations)
│       └── export/
│           └── route.ts        # POST /api/export (ZIP generation)
├── components/
│   ├── ui/                     # Shadcn components (Button, Card, etc.)
│   ├── builder/                # Feature-specific components
│   │   ├── ChatPane.tsx
│   │   ├── PreviewPane.tsx
│   │   └── Sidebar.tsx
│   └── providers/
│       └── Providers.tsx       # Client-side context providers
├── lib/
│   ├── types.ts                # Shared TypeScript interfaces
│   ├── db.ts                   # Prisma client singleton
│   ├── claude.ts               # Claude API client
│   └── utils.ts                # Utility functions (cn, etc.)
└── generated/
    └── prisma/
        └── client/             # Generated Prisma client
```

### File Naming Conventions

- **Components**: PascalCase (e.g., `AgentCard.tsx`)
- **Utilities**: camelCase (e.g., `formatDate.ts`)
- **API routes**: `route.ts` (Next.js convention)
- **Pages**: `page.tsx` (Next.js convention)
- **Types**: `types.ts` or `*.types.ts`

## Next.js 16 Patterns

### Dynamic Route Params as Promises

In Next.js 16, route params are returned as Promises:

```tsx
// ❌ Old (Next.js 15 and earlier)
export default function Page({ params }: { params: { id: string } }) {
  return <div>Agent {params.id}</div>;
}

// ✅ New (Next.js 16)
export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <div>Agent {params.id}</div>;
}
```

### API Route Handlers

```tsx
// src/app/api/agents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/agents
export async function GET(request: NextRequest) {
  try {
    const agents = await prisma.agentProject.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(agents);
  } catch (error) {
    console.error("Failed to fetch agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}

// POST /api/agents
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Input validation
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        { error: "Name is required and must be a string" },
        { status: 400 }
      );
    }

    const agent = await prisma.agentProject.create({
      data: {
        name: body.name,
        slug: generateSlug(body.name),
        config: JSON.stringify(body.config ?? {}),
        // ...
      },
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    console.error("Failed to create agent:", error);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
```

### Dynamic Route Handlers

```tsx
// src/app/api/agents/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const agent = await prisma.agentProject.findUnique({
    where: { id: params.id },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json(agent);
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const body = await request.json();

  // Validate updates (allowlist pattern)
  const allowedFields = ["name", "description", "status"];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([key]) => allowedFields.includes(key))
  );

  const agent = await prisma.agentProject.update({
    where: { id: params.id },
    data: updates,
  });

  return NextResponse.json(agent);
}
```

### Server Components vs Client Components

```tsx
// Server Component (default)
// Can fetch data, access env vars, no useState/useEffect
export default async function AgentsPage() {
  const agents = await prisma.agentProject.findMany();

  return (
    <div>
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}

// Client Component
// Use "use client" directive, can use hooks
"use client";

import { useState } from "react";

export function ChatPane() {
  const [messages, setMessages] = useState([]);

  return <div>{/* ... */}</div>;
}
```

## React 19 Patterns

### useActionState for Forms

```tsx
"use client";

import { useActionState } from "react";

async function createAgent(prevState: any, formData: FormData) {
  const name = formData.get("name") as string;

  const res = await fetch("/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    return { error: "Failed to create agent" };
  }

  return { success: true, agent: await res.json() };
}

export function CreateAgentForm() {
  const [state, formAction] = useActionState(createAgent, null);

  return (
    <form action={formAction}>
      <input name="name" required />
      <button type="submit">Create</button>
      {state?.error && <p className="text-red-500">{state.error}</p>}
    </form>
  );
}
```

### useOptimistic for UI Feedback

```tsx
"use client";

import { useOptimistic, useTransition } from "react";

export function AgentList({ initialAgents }: { initialAgents: Agent[] }) {
  const [agents, setAgents] = useState(initialAgents);
  const [optimisticAgents, addOptimisticAgent] = useOptimistic(
    agents,
    (state, newAgent: Agent) => [...state, newAgent]
  );
  const [isPending, startTransition] = useTransition();

  async function handleCreate(name: string) {
    const tempAgent = { id: "temp", name, status: "draft" };

    // Optimistically add to UI
    startTransition(() => {
      addOptimisticAgent(tempAgent);
    });

    // Actually create
    const res = await fetch("/api/agents", {
      method: "POST",
      body: JSON.stringify({ name }),
    });

    const agent = await res.json();
    setAgents((prev) => [...prev, agent]);
  }

  return (
    <div>
      {optimisticAgents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          isPending={agent.id === "temp"}
        />
      ))}
    </div>
  );
}
```

## Tailwind CSS 4 Patterns

### Configuration (tailwind.config.ts)

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ... more colors
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

### CSS Variables (globals.css)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --primary: 262.1 83.3% 57.8%;
    --primary-foreground: 0 0% 98%;
    /* ... more variables */
    --radius: 0.5rem;
  }

  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --primary: 262.1 83.3% 57.8%;
    --primary-foreground: 0 0% 98%;
    /* ... more variables */
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### Component Styling

```tsx
import { cn } from "@/lib/utils";

interface CardProps {
  variant?: "default" | "outlined";
  className?: string;
  children: React.ReactNode;
}

export function Card({ variant = "default", className, children }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg p-6 transition-colors",
        variant === "default" && "bg-gray-900 shadow-lg",
        variant === "outlined" && "border border-gray-800",
        className
      )}
    >
      {children}
    </div>
  );
}

// Usage
<Card variant="outlined" className="hover:border-gray-700">
  <h3 className="text-lg font-semibold">Card Title</h3>
</Card>
```

### Responsive Design

```tsx
// Mobile-first approach (default = mobile, then add breakpoints)
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
  <Card />
  <Card />
  <Card />
</div>

// Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px), 2xl (1536px)
```

## TypeScript Patterns

### Strict Type Safety

```tsx
// Use interfaces for data models
export interface AgentProject {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "draft" | "building" | "exported";
  config: AgentConfig;
  stages: StageConfig;
  conversations: ConversationHistory;
  createdAt: Date;
  updatedAt: Date;
}

// Use type for unions/utilities
export type ProjectStatus = AgentProject["status"];
export type ApiResponse<T> = { data: T } | { error: string };

// Use const assertions for literals
const STAGE_ORDER = [
  "mission",
  "identity",
  "capabilities",
  "memory",
  "triggers",
  "guardrails",
] as const;
export type Stage = (typeof STAGE_ORDER)[number];
```

### Fetch with Type Safety

```tsx
async function fetchAgent(id: string): Promise<AgentProject | null> {
  const res = await fetch(`/api/agents/${id}`);

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch agent: ${res.statusText}`);
  }

  return res.json() as Promise<AgentProject>;
}

// With error handling
type FetchResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

async function safeFetchAgent(id: string): Promise<FetchResult<AgentProject>> {
  try {
    const res = await fetch(`/api/agents/${id}`);
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

## State Management

### URL State (Preferred)

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function StageSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStage = searchParams.get("stage") ?? "mission";

  function setStage(stage: string) {
    const params = new URLSearchParams(searchParams);
    params.set("stage", stage);
    router.push(`?${params.toString()}`);
  }

  return (
    <select value={currentStage} onChange={(e) => setStage(e.target.value)}>
      <option value="mission">Mission</option>
      <option value="identity">Identity</option>
      {/* ... */}
    </select>
  );
}
```

### React Context (For Global State)

```tsx
// src/components/providers/BuilderProvider.tsx
"use client";

import { createContext, useContext, useState } from "react";

interface BuilderContextType {
  projectId: string | null;
  setProjectId: (id: string) => void;
}

const BuilderContext = createContext<BuilderContextType | undefined>(
  undefined
);

export function BuilderProvider({ children }: { children: React.ReactNode }) {
  const [projectId, setProjectId] = useState<string | null>(null);

  return (
    <BuilderContext.Provider value={{ projectId, setProjectId }}>
      {children}
    </BuilderContext.Provider>
  );
}

export function useBuilder() {
  const context = useContext(BuilderContext);
  if (!context) {
    throw new Error("useBuilder must be used within BuilderProvider");
  }
  return context;
}
```

## Error Handling

### API Error Responses

```tsx
// Consistent error shape
interface ApiError {
  error: string;
  details?: string;
  statusCode?: number;
}

// In route handler
try {
  // ... operation
} catch (error) {
  console.error("Operation failed:", error);

  return NextResponse.json(
    {
      error: "Operation failed",
      details: error instanceof Error ? error.message : "Unknown error",
    } satisfies ApiError,
    { status: 500 }
  );
}
```

### Client-Side Error Boundaries

```tsx
// src/app/error.tsx (route-level error boundary)
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-semibold text-red-500 mb-4">
        Something went wrong
      </h2>
      <p className="text-gray-400 mb-4">{error.message}</p>
      <button
        onClick={reset}
        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md"
      >
        Try again
      </button>
    </div>
  );
}
```

## Performance Patterns

### Streaming with Suspense

```tsx
import { Suspense } from "react";

export default function Page() {
  return (
    <div>
      <h1>Agents</h1>
      <Suspense fallback={<AgentListSkeleton />}>
        <AgentList />
      </Suspense>
    </div>
  );
}

async function AgentList() {
  const agents = await fetchAgents(); // Server-side fetch
  return (
    <div>
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}

function AgentListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse bg-gray-800 h-24 rounded-lg" />
      ))}
    </div>
  );
}
```

### Lazy Loading Components

```tsx
import dynamic from "next/dynamic";

const HeavyEditor = dynamic(() => import("@/components/editor/HeavyEditor"), {
  loading: () => <p>Loading editor...</p>,
  ssr: false, // Disable SSR for client-only components
});

export function EditorPane() {
  return (
    <div>
      <HeavyEditor />
    </div>
  );
}
```

## Testing Patterns

### Component Tests (Vitest + React Testing Library)

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AgentCard } from "./AgentCard";

describe("AgentCard", () => {
  it("renders agent name and status", () => {
    const agent = {
      id: "1",
      name: "Test Agent",
      status: "draft" as const,
      slug: "test-agent",
    };

    render(<AgentCard agent={agent} />);

    expect(screen.getByText("Test Agent")).toBeInTheDocument();
    expect(screen.getByText("draft")).toBeInTheDocument();
  });
});
```

---

**Last Updated**: 2026-02-13
**Reference Projects**: Agent OS, Next.js 16 App Router
