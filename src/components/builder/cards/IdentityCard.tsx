"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { User } from "lucide-react";
import { SectionCard } from "../SectionCard";
import { PillSelector } from "../PillSelector";
import type { IdentityConfig, CardStatus, CalloutHandlers } from "@/lib/types";

const TONE_OPTIONS = [
  "casual",
  "casual-professional",
  "professional",
  "technical",
  "playful",
];

interface IdentityCardProps extends CalloutHandlers {
  config: IdentityConfig;
  onChange: (config: IdentityConfig) => void;
}

function computeStatus(config: IdentityConfig): CardStatus {
  if (!config.name && !config.vibe && !config.tone && !config.greeting) return "empty";
  if (config.name && config.tone) return "done";
  return "draft";
}

export function IdentityCard({
  config,
  onChange,
  callouts,
  onAcceptCallout,
  onDismissCallout,
  onAnswerCallout,
  enriching,
}: IdentityCardProps) {
  const baseId = useId();
  function update(partial: Partial<IdentityConfig>) {
    onChange({ ...config, ...partial });
  }

  return (
    <SectionCard
      title="Identity"
      icon={<User className="h-4 w-4 text-zinc-400" />}
      status={computeStatus(config)}
      enriching={enriching}
      callouts={callouts}
      onAcceptCallout={onAcceptCallout}
      onDismissCallout={onDismissCallout}
      onAnswerCallout={onAnswerCallout}
    >
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <label htmlFor={`${baseId}-name`} className="text-xs font-medium text-zinc-400 mb-1 block">Name</label>
          <Input
            id={`${baseId}-name`}
            value={config.name || ""}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Agent name"
            className="h-8 text-sm bg-zinc-900 border-zinc-800"
          />
        </div>
        <div>
          <label htmlFor={`${baseId}-emoji`} className="text-xs font-medium text-zinc-400 mb-1 block">Emoji</label>
          <Input
            id={`${baseId}-emoji`}
            value={config.emoji || ""}
            onChange={(e) => {
              // Limit to single grapheme cluster
              const val = e.target.value;
              const segments = [...new Intl.Segmenter().segment(val)];
              update({ emoji: segments.length > 0 ? segments[segments.length - 1].segment : "" });
            }}
            placeholder="🤖"
            className="h-8 w-16 text-center text-sm bg-zinc-900 border-zinc-800"
            maxLength={4}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${baseId}-vibe`} className="text-xs font-medium text-zinc-400 mb-1 block">Vibe</label>
        <Input
          id={`${baseId}-vibe`}
          value={config.vibe || ""}
          onChange={(e) => update({ vibe: e.target.value })}
          placeholder="Friendly, helpful, solution-oriented"
          className="h-8 text-sm bg-zinc-900 border-zinc-800"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Tone</label>
        <PillSelector
          value={config.tone || ""}
          options={TONE_OPTIONS}
          onChange={(tone) => update({ tone })}
        />
      </div>

      <div>
        <label htmlFor={`${baseId}-greeting`} className="text-xs font-medium text-zinc-400 mb-1 block">Greeting</label>
        <Textarea
          id={`${baseId}-greeting`}
          value={config.greeting || ""}
          onChange={(e) => update({ greeting: e.target.value })}
          placeholder="Hey! I'm your agent. What can I help you with?"
          className="min-h-[60px] text-sm bg-zinc-900 border-zinc-800 resize-none rounded-xl"
        />
      </div>
    </SectionCard>
  );
}
