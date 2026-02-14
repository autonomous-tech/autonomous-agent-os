"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Shield } from "lucide-react";
import { SectionCard } from "../SectionCard";
import { PillSelector } from "../PillSelector";
import { TagInput } from "../TagInput";
import type { GuardrailsConfig, CardStatus, CalloutHandlers } from "@/lib/types";

const DEFENSE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "moderate", label: "Moderate" },
  { value: "strict", label: "Strict" },
];

interface BoundariesCardProps extends CalloutHandlers {
  guardrails: GuardrailsConfig;
  exclusions: string[];
  onGuardrailsChange: (config: GuardrailsConfig) => void;
  onExclusionsChange: (exclusions: string[]) => void;
}

function computeStatus(guardrails: GuardrailsConfig, exclusions: string[]): CardStatus {
  const hasBehavioral = guardrails.behavioral && guardrails.behavioral.length > 0;
  const hasExclusions = exclusions.length > 0;
  const hasDefense = guardrails.prompt_injection_defense && guardrails.prompt_injection_defense !== "none";
  if (!hasBehavioral && !hasExclusions && !hasDefense) return "empty";
  if (hasBehavioral || hasDefense) return "done";
  return "draft";
}

export function BoundariesCard({
  guardrails,
  exclusions,
  onGuardrailsChange,
  onExclusionsChange,
  callouts,
  onAcceptCallout,
  onDismissCallout,
  onAnswerCallout,
  enriching,
}: BoundariesCardProps) {
  const [showLimits, setShowLimits] = useState(false);

  function updateGuardrails(partial: Partial<GuardrailsConfig>) {
    onGuardrailsChange({ ...guardrails, ...partial });
  }

  return (
    <SectionCard
      title="Boundaries"
      icon={<Shield className="h-4 w-4 text-zinc-400" />}
      status={computeStatus(guardrails, exclusions)}
      enriching={enriching}
      callouts={callouts}
      onAcceptCallout={onAcceptCallout}
      onDismissCallout={onDismissCallout}
      onAnswerCallout={onAnswerCallout}
    >
      <div>
        <label className="text-xs font-medium text-zinc-400 mb-1 block">Behavioral Rules</label>
        <TagInput
          values={guardrails.behavioral || []}
          onChange={(behavioral) => updateGuardrails({ behavioral })}
          placeholder="Add a rule"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-400 mb-1 block">Exclusions</label>
        <TagInput
          values={exclusions}
          onChange={onExclusionsChange}
          placeholder="What should the agent NOT do?"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Prompt Injection Defense</label>
        <PillSelector
          value={guardrails.prompt_injection_defense || "none"}
          options={DEFENSE_OPTIONS}
          onChange={(val) =>
            updateGuardrails({ prompt_injection_defense: val as GuardrailsConfig["prompt_injection_defense"] })
          }
        />
      </div>

      {/* Collapsible resource limits */}
      <div>
        <button
          type="button"
          onClick={() => setShowLimits(!showLimits)}
          aria-expanded={showLimits}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {showLimits ? "Hide" : "Show"} resource limits
        </button>
        {showLimits && (
          <div className="mt-2 space-y-2">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Max turns per session</label>
              <Input
                type="number"
                value={guardrails.resource_limits?.max_turns_per_session ?? ""}
                onChange={(e) => {
                  const parsed = parseInt(e.target.value);
                  const value = !e.target.value ? undefined : (isNaN(parsed) || parsed < 1) ? 1 : parsed;
                  updateGuardrails({
                    resource_limits: {
                      ...guardrails.resource_limits,
                      max_turns_per_session: value,
                    },
                  });
                }}
                min={1}
                placeholder="25"
                className="h-7 w-24 text-xs bg-zinc-900 border-zinc-800"
              />
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
