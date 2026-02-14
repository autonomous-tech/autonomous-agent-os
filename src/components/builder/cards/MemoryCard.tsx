"use client";

import { Brain } from "lucide-react";
import { SectionCard } from "../SectionCard";
import { PillSelector } from "../PillSelector";
import { TagInput } from "../TagInput";
import type { MemoryConfig, CardStatus, CalloutHandlers } from "@/lib/types";

const STRATEGY_OPTIONS = [
  { value: "conversational", label: "Conversational" },
  { value: "task-based", label: "Task-based" },
  { value: "minimal", label: "Minimal" },
];

const STRATEGY_HINTS: Record<string, string> = {
  conversational: "Proactively remember context from conversations. Update memory after meaningful exchanges.",
  "task-based": "Remember outcomes and learnings from completed tasks. Update memory when tasks finish.",
  minimal: "Only store explicitly requested information. Minimal automatic memory updates.",
};

interface MemoryCardProps extends CalloutHandlers {
  config: MemoryConfig;
  onChange: (config: MemoryConfig) => void;
}

function computeStatus(config: MemoryConfig): CardStatus {
  if (!config.strategy && (!config.remember || config.remember.length === 0)) return "empty";
  if (config.strategy) return "done";
  return "draft";
}

export function MemoryCard({
  config,
  onChange,
  callouts,
  onAcceptCallout,
  onDismissCallout,
  onAnswerCallout,
  enriching,
}: MemoryCardProps) {
  function update(partial: Partial<MemoryConfig>) {
    onChange({ ...config, ...partial });
  }

  return (
    <SectionCard
      title="Memory Protocol"
      icon={<Brain className="h-4 w-4 text-zinc-400" />}
      status={computeStatus(config)}
      enriching={enriching}
      callouts={callouts}
      onAcceptCallout={onAcceptCallout}
      onDismissCallout={onDismissCallout}
      onAnswerCallout={onAnswerCallout}
    >
      <div>
        <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Strategy</label>
        <PillSelector
          value={config.strategy || ""}
          options={STRATEGY_OPTIONS}
          onChange={(strategy) => update({ strategy: strategy as MemoryConfig["strategy"] })}
        />
        {config.strategy && STRATEGY_HINTS[config.strategy] && (
          <p className="text-xs text-zinc-500 mt-1.5 italic">
            {STRATEGY_HINTS[config.strategy]}
          </p>
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-400 mb-1 block">What to Remember</label>
        <TagInput
          values={config.remember || []}
          onChange={(remember) => update({ remember })}
          placeholder="Add something to remember"
        />
      </div>
    </SectionCard>
  );
}
