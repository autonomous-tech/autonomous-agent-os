"use client";

import { TextBlock, BulletList, ChipGroup } from "@/components/preview";
import type { MissionConfig } from "@/lib/types";

interface MissionSectionProps {
  config: MissionConfig;
  draft: Record<string, unknown>;
  editing: boolean;
  onDraftChange: (draft: Record<string, unknown>) => void;
}

export function MissionSection({
  config,
  draft,
  editing,
  onDraftChange,
}: MissionSectionProps) {
  if (editing) {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Description
          </label>
          <TextBlock
            value={(draft.description as string) || ""}
            onChange={(val) => onDraftChange({ ...draft, description: val })}
            editing
            placeholder="What does this agent do?"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Tasks
          </label>
          <BulletList
            items={(draft.tasks as string[]) || []}
            onChange={(tasks) => onDraftChange({ ...draft, tasks })}
            editing
            placeholder="Task description"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Exclusions
          </label>
          <BulletList
            items={(draft.exclusions as string[]) || []}
            onChange={(exclusions) => onDraftChange({ ...draft, exclusions })}
            editing
            placeholder="What the agent should NOT do"
            variant="negative"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Audience Scope
          </label>
          <ChipGroup
            value={(draft.audience as MissionConfig["audience"])?.scope || ""}
            options={["owner-only", "team", "public"]}
            onChange={(val) =>
              onDraftChange({
                ...draft,
                audience: {
                  ...((draft.audience as Record<string, unknown>) || {}),
                  scope: val,
                },
              })
            }
            editing
          />
        </div>
      </div>
    );
  }

  const hasContent =
    config.description ||
    (config.tasks && config.tasks.length > 0) ||
    (config.exclusions && config.exclusions.length > 0);

  if (!hasContent) {
    return (
      <p className="text-sm text-muted-foreground italic">Not configured</p>
    );
  }

  return (
    <div className="space-y-2">
      {config.description && (
        <TextBlock value={config.description} />
      )}
      {config.tasks && config.tasks.length > 0 && (
        <div>
          <span className="text-xs font-medium text-muted-foreground">
            Tasks:
          </span>
          <div className="mt-1">
            <BulletList items={config.tasks} />
          </div>
        </div>
      )}
      {config.exclusions && config.exclusions.length > 0 && (
        <div>
          <span className="text-xs font-medium text-muted-foreground">
            Exclusions:
          </span>
          <div className="mt-1">
            <BulletList items={config.exclusions} variant="negative" />
          </div>
        </div>
      )}
      {config.audience?.scope && (
        <div>
          <span className="text-xs font-medium text-muted-foreground">
            Audience:
          </span>
          <div className="mt-1">
            <ChipGroup value={config.audience.scope} />
          </div>
        </div>
      )}
    </div>
  );
}
