"use client";

import { ChipGroup, BulletList } from "@/components/preview";
import type { MemoryConfig } from "@/lib/types";

interface MemorySectionProps {
  config: MemoryConfig;
  draft: Record<string, unknown>;
  editing: boolean;
  onDraftChange: (draft: Record<string, unknown>) => void;
}

const STRATEGY_OPTIONS = ["conversational", "task-based", "minimal"];

export function MemorySection({
  config,
  draft,
  editing,
  onDraftChange,
}: MemorySectionProps) {
  if (editing) {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Strategy
          </label>
          <ChipGroup
            value={(draft.strategy as string) || "conversational"}
            options={STRATEGY_OPTIONS}
            onChange={(val) => onDraftChange({ ...draft, strategy: val })}
            editing
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Remember
          </label>
          <BulletList
            items={(draft.remember as string[]) || []}
            onChange={(remember) => onDraftChange({ ...draft, remember })}
            editing
            placeholder="What to remember"
          />
        </div>
      </div>
    );
  }

  if (!config.strategy) {
    return (
      <p className="text-sm text-muted-foreground italic">Not configured</p>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <span className="text-xs font-medium text-muted-foreground mr-1.5">
          Strategy:
        </span>
        <ChipGroup value={config.strategy} />
      </div>
      {config.remember && config.remember.length > 0 && (
        <BulletList items={config.remember} />
      )}
    </div>
  );
}
