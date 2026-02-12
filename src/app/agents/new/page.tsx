"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Loader2,
  Headphones,
  Search,
  TrendingUp,
} from "lucide-react";
import { ARCHETYPES, AUDIENCE_OPTIONS } from "@/lib/archetypes";

const TEMPLATES = [
  {
    id: "tpl_support",
    name: "Customer Support",
    description: "Answers FAQs, logs issues, escalates to humans",
    icon: Headphones,
  },
  {
    id: "tpl_research",
    name: "Research Assistant",
    description: "Monitors topics, summarizes findings, maintains knowledge",
    icon: Search,
  },
  {
    id: "tpl_sales",
    name: "Sales Support",
    description: "Drafts outreach, researches prospects, prepares for calls",
    icon: TrendingUp,
  },
];

export default function NewAgentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [archetype, setArchetype] = useState<string | null>(null);
  const [customDescription, setCustomDescription] = useState("");
  const [audience, setAudience] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");
  const [context, setContext] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const selectedArchetype = ARCHETYPES.find((a) => a.id === archetype);

  const createFromTemplate = async (templateId: string) => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) throw new Error("Failed to create agent");
      const data = await res.json();
      router.push(`/agents/${data.id}`);
    } catch (error) {
      console.error("Create agent error:", error);
      setIsCreating(false);
    }
  };

  const createFromStructured = async (skipContext?: boolean) => {
    if (!archetype || !audience || !agentName.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archetype,
          audience,
          name: agentName.trim(),
          context: skipContext ? undefined : context.trim() || undefined,
          customDescription:
            archetype === "custom" ? customDescription.trim() || undefined : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create agent");
      const data = await res.json();
      router.push(`/agents/${data.id}`);
    } catch (error) {
      console.error("Create agent error:", error);
      setIsCreating(false);
    }
  };

  const handleArchetypeSelect = (id: string) => {
    setArchetype(id);
    if (id !== "custom") {
      setCustomDescription("");
      setStep(2);
    }
  };

  const handleCustomContinue = () => {
    setStep(2);
  };

  const handleAudienceSelect = (id: string) => {
    setAudience(id);
    setStep(3);
  };

  const handleNameNext = () => {
    if (agentName.trim()) {
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const stepTitles: Record<number, string> = {
    1: "What kind of agent?",
    2: "Who will use it?",
    3: "Give it a name",
    4: "Review & Create",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-6">
          {step === 1 ? (
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          ) : (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
          <h1 className="ml-4 text-lg font-bold tracking-tight">New Agent</h1>
        </div>
      </header>

      {/* Step indicator dots */}
      <div className="mx-auto flex max-w-3xl justify-center gap-2 px-6 pt-6">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-2 w-2 rounded-full transition-colors ${
              s === step ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Loading overlay */}
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Setting up your agent...
              </p>
            </div>
          </div>
        )}

        {/* Step 1: What kind of agent? */}
        <div
          className="transition-all duration-300"
          style={{
            opacity: step === 1 ? 1 : 0,
            transform: step === 1 ? "translateY(0)" : "translateY(-10px)",
            display: step === 1 ? "block" : "none",
          }}
        >
          <h2 className="text-2xl font-bold mb-2">{stepTitles[1]}</h2>
          <p className="text-muted-foreground mb-6">
            Pick a starting archetype for your agent.
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-6">
            {ARCHETYPES.map((arc) => (
              <Card
                key={arc.id}
                className={`cursor-pointer transition-all hover:bg-accent/50 ${
                  archetype === arc.id
                    ? "ring-2 ring-primary"
                    : ""
                }`}
                onClick={() => handleArchetypeSelect(arc.id)}
              >
                <CardHeader className="pb-2">
                  <div className="text-2xl mb-1">{arc.emoji}</div>
                  <CardTitle className="text-sm">{arc.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {arc.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* Custom description textarea (shown when "custom" selected) */}
          {archetype === "custom" && (
            <div className="mb-6 space-y-3">
              <Textarea
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Describe what your agent should do..."
                className="min-h-[80px]"
                autoFocus
              />
              <Button
                onClick={handleCustomContinue}
                disabled={!customDescription.trim()}
              >
                Continue
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground mb-8">
            Just a starting point — you&apos;ll customize everything next.
          </p>

          {/* Template section */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Or start from a complete template
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {TEMPLATES.map((template) => {
                const Icon = template.icon;
                return (
                  <Card
                    key={template.id}
                    className="cursor-pointer transition-colors hover:bg-accent/50"
                    onClick={() => createFromTemplate(template.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-sm">
                          {template.name}
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step 2: Who will use it? */}
        <div
          className="transition-all duration-300"
          style={{
            opacity: step === 2 ? 1 : 0,
            transform: step === 2 ? "translateY(0)" : "translateY(-10px)",
            display: step === 2 ? "block" : "none",
          }}
        >
          <h2 className="text-2xl font-bold mb-2">{stepTitles[2]}</h2>
          <p className="text-muted-foreground mb-6">
            This helps shape tone, access, and guardrails.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {AUDIENCE_OPTIONS.map((opt) => (
              <Card
                key={opt.id}
                className={`cursor-pointer transition-all hover:bg-accent/50 ${
                  audience === opt.id
                    ? "ring-2 ring-primary"
                    : ""
                }`}
                onClick={() => handleAudienceSelect(opt.id)}
              >
                <CardHeader>
                  <CardTitle className="text-sm">{opt.label}</CardTitle>
                  <CardDescription className="text-xs">
                    {opt.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {/* Step 3: Give it a name */}
        <div
          className="transition-all duration-300"
          style={{
            opacity: step === 3 ? 1 : 0,
            transform: step === 3 ? "translateY(0)" : "translateY(-10px)",
            display: step === 3 ? "block" : "none",
          }}
        >
          <h2 className="text-2xl font-bold mb-2">{stepTitles[3]}</h2>
          <p className="text-muted-foreground mb-6">
            Pick a name for your agent.
          </p>

          <Input
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="e.g., Fixie, Scout, Muse"
            className="mb-3 h-11"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameNext();
            }}
          />

          {/* Suggested name pills */}
          {selectedArchetype && (
            <div className="flex gap-2 mb-4">
              {selectedArchetype.suggestedNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setAgentName(name)}
                  className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground mb-6">
            You can rename it anytime.
          </p>

          <Button
            onClick={handleNameNext}
            disabled={!agentName.trim()}
            className="h-11 px-6"
          >
            Next
          </Button>
        </div>

        {/* Step 4: Review + Create */}
        <div
          className="transition-all duration-300"
          style={{
            opacity: step === 4 ? 1 : 0,
            transform: step === 4 ? "translateY(0)" : "translateY(-10px)",
            display: step === 4 ? "block" : "none",
          }}
        >
          <h2 className="text-2xl font-bold mb-2">Review &amp; Create</h2>
          <p className="text-muted-foreground mb-6">
            Here&apos;s what we&apos;ll start with.
          </p>

          {/* Summary */}
          <div className="mb-6 rounded-lg border p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span>
                {selectedArchetype
                  ? `${selectedArchetype.emoji} ${selectedArchetype.name}`
                  : archetype}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Audience</span>
              <span>
                {AUDIENCE_OPTIONS.find((o) => o.id === audience)?.label ||
                  audience}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{agentName}</span>
            </div>
          </div>

          {/* Optional context */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Anything specific? (tasks, tools, constraints)
            </label>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g., Should focus on billing and login issues, uses Zendesk API..."
              className="min-h-[80px]"
            />
          </div>

          <p className="text-xs text-muted-foreground mb-6">
            Everything here is a starting point. The builder will help you
            refine it.
          </p>

          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => createFromStructured(true)}
              disabled={isCreating}
              className="h-11"
            >
              Skip &amp; Create
            </Button>
            <Button
              onClick={() => createFromStructured(false)}
              disabled={isCreating}
              className="h-11 px-6"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                `Create ${agentName}`
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
