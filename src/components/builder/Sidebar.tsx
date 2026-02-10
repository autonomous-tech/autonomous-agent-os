"use client";

import { cn } from "@/lib/utils";
import { STAGES, type StageName, type StageStatus } from "@/lib/types";
import { Check } from "lucide-react";

interface SidebarProps {
  currentStage: StageName;
  stageStatuses: Record<StageName, StageStatus>;
  onStageSelect: (stage: StageName) => void;
}

const stageLabels: Record<StageName, string> = {
  mission: "Mission",
  identity: "Identity",
  capabilities: "Capabilities",
  memory: "Memory",
  triggers: "Triggers",
  guardrails: "Guardrails",
};

const stageIcons: Record<StageName, string> = {
  mission: "1",
  identity: "2",
  capabilities: "3",
  memory: "4",
  triggers: "5",
  guardrails: "6",
};

export function Sidebar({
  currentStage,
  stageStatuses,
  onStageSelect,
}: SidebarProps) {
  return (
    <div className="flex h-full w-48 flex-col border-r bg-card">
      <div className="p-4 border-b">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Stages
        </h2>
      </div>
      <nav className="flex flex-col gap-1 p-2">
        {STAGES.map((stage) => {
          const status = stageStatuses[stage] || "incomplete";
          const isActive = stage === currentStage;
          const isApproved = status === "approved";
          const isDraft = status === "draft";

          return (
            <button
              key={stage}
              onClick={() => onStageSelect(stage)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold shrink-0",
                  isApproved
                    ? "bg-green-600 text-white"
                    : isDraft
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {isApproved ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  stageIcons[stage]
                )}
              </span>
              <span>{stageLabels[stage]}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
