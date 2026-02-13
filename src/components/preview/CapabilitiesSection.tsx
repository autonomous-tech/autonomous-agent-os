"use client";

import { Plus } from "lucide-react";
import { ToolCard } from "@/components/preview";
import type { CapabilitiesConfig, Capability } from "@/lib/types";

interface CapabilitiesSectionProps {
  config: CapabilitiesConfig;
  tools: Capability[];
  draft: Record<string, unknown>;
  editing: boolean;
  onDraftChange: (draft: Record<string, unknown>) => void;
}

export function CapabilitiesSection({
  tools,
  draft,
  editing,
  onDraftChange,
}: CapabilitiesSectionProps) {
  if (editing) {
    const draftTools = (draft.tools as Capability[]) || [];

    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Tools
        </label>
        {draftTools.map((tool, i) => (
          <ToolCard
            key={i}
            tool={tool}
            onChange={(updated) => {
              const newTools = [...draftTools];
              newTools[i] = updated as Capability;
              onDraftChange({ ...draft, tools: newTools });
            }}
            onDelete={() => {
              const newTools = draftTools.filter((_, idx) => idx !== i);
              onDraftChange({ ...draft, tools: newTools });
            }}
            editing
          />
        ))}
        <button
          type="button"
          onClick={() => {
            const newTools = [
              ...draftTools,
              { name: "", access: "read-only" as const, description: "" },
            ];
            onDraftChange({ ...draft, tools: newTools });
          }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add tool
        </button>
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">Not configured</p>
    );
  }

  return (
    <div className="space-y-1.5">
      {tools.map((tool, i) => (
        <ToolCard key={i} tool={tool} />
      ))}
      <p className="text-[10px] text-muted-foreground/50 mt-2">
        These describe what the agent should have access to. They appear in the
        exported system prompt — the deployment platform is responsible for
        wiring up actual integrations.
      </p>
    </div>
  );
}
