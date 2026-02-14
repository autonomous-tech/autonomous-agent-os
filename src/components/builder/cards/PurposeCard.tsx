"use client";

import { useId } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Target } from "lucide-react";
import { SectionCard } from "../SectionCard";
import { TagInput } from "../TagInput";
import type { MissionConfig, CardStatus, CalloutHandlers } from "@/lib/types";

interface PurposeCardProps extends CalloutHandlers {
  config: MissionConfig;
  onChange: (config: MissionConfig) => void;
}

function computeStatus(config: MissionConfig): CardStatus {
  if (!config.description && (!config.tasks || config.tasks.length === 0)) return "empty";
  if (config.description && config.tasks && config.tasks.length >= 2) return "done";
  return "draft";
}

export function PurposeCard({
  config,
  onChange,
  callouts,
  onAcceptCallout,
  onDismissCallout,
  onAnswerCallout,
  enriching,
}: PurposeCardProps) {
  const baseId = useId();
  function update(partial: Partial<MissionConfig>) {
    onChange({ ...config, ...partial });
  }

  return (
    <SectionCard
      title="Purpose"
      icon={<Target className="h-4 w-4 text-zinc-400" />}
      status={computeStatus(config)}
      enriching={enriching}
      callouts={callouts}
      onAcceptCallout={onAcceptCallout}
      onDismissCallout={onDismissCallout}
      onAnswerCallout={onAnswerCallout}
    >
      <div>
        <label htmlFor={`${baseId}-desc`} className="text-xs font-medium text-zinc-400 mb-1 block">Description</label>
        <Textarea
          id={`${baseId}-desc`}
          value={config.description || ""}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="What does this agent do? (1-3 sentences)"
          className="min-h-[60px] text-sm bg-zinc-900 border-zinc-800 resize-none"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-400 mb-1 block">Key Tasks</label>
        <TagInput
          values={config.tasks || []}
          onChange={(tasks) => update({ tasks })}
          placeholder="Add a task and press Enter"
        />
      </div>
    </SectionCard>
  );
}
