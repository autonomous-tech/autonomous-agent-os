"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Users } from "lucide-react";
import { SectionCard } from "../SectionCard";
import { PillSelector } from "../PillSelector";
import type { MissionConfig, CardStatus, CalloutHandlers } from "@/lib/types";

interface AudienceCardProps extends CalloutHandlers {
  audience: MissionConfig["audience"];
  onChange: (audience: MissionConfig["audience"]) => void;
}

const SCOPE_OPTIONS = [
  { value: "owner-only", label: "Owner only" },
  { value: "team", label: "Team" },
  { value: "public", label: "Public" },
];

function computeStatus(audience: MissionConfig["audience"]): CardStatus {
  if (!audience?.primary && !audience?.scope) return "empty";
  if (audience.primary && audience.scope) return "done";
  return "draft";
}

export function AudienceCard({
  audience,
  onChange,
  callouts,
  onAcceptCallout,
  onDismissCallout,
  onAnswerCallout,
  enriching,
}: AudienceCardProps) {
  const baseId = useId();
  function update(partial: Partial<NonNullable<MissionConfig["audience"]>>) {
    onChange({ ...audience, ...partial });
  }

  return (
    <SectionCard
      title="Audience"
      icon={<Users className="h-4 w-4 text-zinc-400" />}
      status={computeStatus(audience)}
      optional
      enriching={enriching}
      callouts={callouts}
      onAcceptCallout={onAcceptCallout}
      onDismissCallout={onDismissCallout}
      onAnswerCallout={onAnswerCallout}
    >
      <div>
        <label htmlFor={`${baseId}-primary`} className="text-xs font-medium text-zinc-400 mb-1 block">Primary Audience</label>
        <Input
          id={`${baseId}-primary`}
          value={audience?.primary || ""}
          onChange={(e) => update({ primary: e.target.value })}
          placeholder="Who will use this agent?"
          className="h-8 text-sm bg-zinc-900 border-zinc-800"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Scope</label>
        <PillSelector
          value={audience?.scope || ""}
          options={SCOPE_OPTIONS}
          onChange={(scope) => update({ scope: scope as "owner-only" | "team" | "public" })}
        />
      </div>
    </SectionCard>
  );
}
