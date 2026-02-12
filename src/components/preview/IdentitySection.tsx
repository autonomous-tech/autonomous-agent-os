"use client";

import { Input } from "@/components/ui/input";
import { TextBlock, ChipGroup, QuoteBlock } from "@/components/preview";
import type { IdentityConfig } from "@/lib/types";

interface IdentitySectionProps {
  config: IdentityConfig;
  draft: Record<string, unknown>;
  editing: boolean;
  onDraftChange: (draft: Record<string, unknown>) => void;
}

const TONE_OPTIONS = ["friendly", "professional", "casual", "formal", "concise"];

export function IdentitySection({
  config,
  draft,
  editing,
  onDraftChange,
}: IdentitySectionProps) {
  if (editing) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Name
            </label>
            <Input
              value={(draft.name as string) || ""}
              onChange={(e) =>
                onDraftChange({ ...draft, name: e.target.value })
              }
              className="h-7 text-xs"
              placeholder="Agent name"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Emoji
            </label>
            <Input
              value={(draft.emoji as string) || ""}
              onChange={(e) =>
                onDraftChange({ ...draft, emoji: e.target.value })
              }
              className="h-7 text-xs"
              placeholder="e.g. 🤖"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Tone
          </label>
          <ChipGroup
            value={(draft.tone as string) || ""}
            options={TONE_OPTIONS}
            onChange={(val) => onDraftChange({ ...draft, tone: val })}
            editing
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Vibe / Personality
          </label>
          <TextBlock
            value={(draft.vibe as string) || ""}
            onChange={(val) => onDraftChange({ ...draft, vibe: val })}
            editing
            placeholder="Describe the agent's personality"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Greeting
          </label>
          <QuoteBlock
            value={(draft.greeting as string) || ""}
            onChange={(val) => onDraftChange({ ...draft, greeting: val })}
            editing
            placeholder="Sample greeting message"
          />
        </div>
      </div>
    );
  }

  if (!config.name) {
    return (
      <p className="text-sm text-muted-foreground italic">Not configured</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{config.name}</span>
        {config.emoji && <span>{config.emoji}</span>}
      </div>
      {config.tone && (
        <div>
          <span className="text-xs font-medium text-muted-foreground mr-1.5">
            Tone:
          </span>
          <ChipGroup value={config.tone} />
        </div>
      )}
      {config.vibe && (
        <TextBlock value={config.vibe} />
      )}
      {config.greeting && (
        <QuoteBlock value={config.greeting} />
      )}
    </div>
  );
}
