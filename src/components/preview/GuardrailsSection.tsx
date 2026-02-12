"use client";

import { BulletList, ChipGroup, KeyValueRow } from "@/components/preview";
import type { GuardrailsConfig } from "@/lib/types";

interface GuardrailsSectionProps {
  config: GuardrailsConfig;
  draft: Record<string, unknown>;
  editing: boolean;
  onDraftChange: (draft: Record<string, unknown>) => void;
}

const DEFENSE_OPTIONS = ["strict", "moderate", "none"];

export function GuardrailsSection({
  config,
  draft,
  editing,
  onDraftChange,
}: GuardrailsSectionProps) {
  if (editing) {
    const draftLimits =
      (draft.resource_limits as Record<string, unknown>) || {};

    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Behavioral Rules
          </label>
          <BulletList
            items={(draft.behavioral as string[]) || []}
            onChange={(behavioral) =>
              onDraftChange({ ...draft, behavioral })
            }
            editing
            placeholder="Rule or constraint"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Prompt Injection Defense
          </label>
          <ChipGroup
            value={(draft.prompt_injection_defense as string) || "strict"}
            options={DEFENSE_OPTIONS}
            onChange={(val) =>
              onDraftChange({ ...draft, prompt_injection_defense: val })
            }
            editing
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Resource Limits
          </label>
          <div className="space-y-1.5">
            <KeyValueRow
              label="Max turns per session"
              value={(draftLimits.max_turns_per_session as number) ?? ""}
              onChange={(val) =>
                onDraftChange({
                  ...draft,
                  resource_limits: {
                    ...draftLimits,
                    max_turns_per_session: val ? Number(val) : undefined,
                  },
                })
              }
              editing
              type="number"
            />
            <KeyValueRow
              label="Escalation threshold"
              value={(draftLimits.escalation_threshold as number) ?? ""}
              onChange={(val) =>
                onDraftChange({
                  ...draft,
                  resource_limits: {
                    ...draftLimits,
                    escalation_threshold: val ? Number(val) : undefined,
                  },
                })
              }
              editing
              type="number"
            />
            <KeyValueRow
              label="Max response length"
              value={(draftLimits.max_response_length as number) ?? ""}
              onChange={(val) =>
                onDraftChange({
                  ...draft,
                  resource_limits: {
                    ...draftLimits,
                    max_response_length: val ? Number(val) : undefined,
                  },
                })
              }
              editing
              type="number"
            />
          </div>
        </div>
      </div>
    );
  }

  const hasContent =
    (config.behavioral && config.behavioral.length > 0) ||
    config.prompt_injection_defense ||
    config.resource_limits;

  if (!hasContent) {
    return (
      <p className="text-sm text-muted-foreground italic">Not configured</p>
    );
  }

  return (
    <div className="space-y-2">
      {config.behavioral && config.behavioral.length > 0 && (
        <div>
          <span className="text-xs font-medium text-muted-foreground">
            Rules:
          </span>
          <div className="mt-1">
            <BulletList items={config.behavioral} />
          </div>
        </div>
      )}
      {config.prompt_injection_defense && (
        <div>
          <span className="text-xs font-medium text-muted-foreground mr-1.5">
            Prompt injection defense:
          </span>
          <ChipGroup value={config.prompt_injection_defense} />
        </div>
      )}
      {config.resource_limits && (
        <div className="space-y-1">
          {config.resource_limits.max_turns_per_session != null && (
            <KeyValueRow
              label="Max turns per session"
              value={config.resource_limits.max_turns_per_session}
            />
          )}
          {config.resource_limits.escalation_threshold != null && (
            <KeyValueRow
              label="Escalation threshold"
              value={config.resource_limits.escalation_threshold}
            />
          )}
          {config.resource_limits.max_response_length != null && (
            <KeyValueRow
              label="Max response length"
              value={config.resource_limits.max_response_length}
            />
          )}
        </div>
      )}
    </div>
  );
}
