"use client";

import { Plus } from "lucide-react";
import { TriggerRow } from "@/components/preview";
import type { Trigger, TriggersConfig } from "@/lib/types";

interface TriggersSectionProps {
  config: TriggersConfig;
  triggers: Trigger[];
  draft: Record<string, unknown>;
  editing: boolean;
  onDraftChange: (draft: Record<string, unknown>) => void;
}

export function TriggersSection({
  config,
  triggers,
  draft,
  editing,
  onDraftChange,
}: TriggersSectionProps) {
  if (editing) {
    const draftTriggers = (draft.triggers as Trigger[]) || [];

    return (
      <div className="space-y-2">
        {draftTriggers.map((trigger, i) => (
          <TriggerRow
            key={i}
            trigger={trigger}
            onChange={(updated) => {
              const newTriggers = [...draftTriggers];
              newTriggers[i] = updated as Trigger;
              onDraftChange({ ...draft, triggers: newTriggers });
            }}
            onDelete={() => {
              const newTriggers = draftTriggers.filter((_, idx) => idx !== i);
              onDraftChange({ ...draft, triggers: newTriggers });
            }}
            editing
          />
        ))}
        <button
          type="button"
          onClick={() => {
            const newTriggers = [
              ...draftTriggers,
              { type: "message" as const, description: "" },
            ];
            onDraftChange({ ...draft, triggers: newTriggers });
          }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add trigger
        </button>
      </div>
    );
  }

  if (triggers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">Not configured</p>
    );
  }

  return (
    <div className="space-y-1.5">
      {triggers.map((trigger, i) => (
        <TriggerRow key={i} trigger={trigger} />
      ))}
    </div>
  );
}
