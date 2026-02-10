"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Loader2, Headphones, Search, TrendingUp } from "lucide-react";

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
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createAgent = async (initialDescription?: string, templateId?: string) => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initialDescription: initialDescription || undefined,
          templateId: templateId || undefined,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    createAgent(description.trim());
  };

  const handleTemplateSelect = (templateId: string) => {
    createAgent(undefined, templateId);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="ml-4 text-lg font-bold tracking-tight">
            New Agent
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
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

        {/* Description input */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold mb-2">
            Describe the AI agent you want to build
          </h2>
          <p className="text-muted-foreground mb-6">
            One sentence is all it takes to get started.
          </p>
          <form onSubmit={handleSubmit} className="flex gap-3">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., A customer support agent for my SaaS product"
              className="flex-1 h-11"
              disabled={isCreating}
              autoFocus
            />
            <Button
              type="submit"
              disabled={!description.trim() || isCreating}
              className="h-11 px-6"
            >
              Create
            </Button>
          </form>
        </div>

        {/* Templates */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Or start from a template
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {TEMPLATES.map((template) => {
              const Icon = template.icon;
              return (
                <Card
                  key={template.id}
                  className="cursor-pointer transition-colors hover:bg-accent/50"
                  onClick={() => handleTemplateSelect(template.id)}
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
      </main>
    </div>
  );
}
