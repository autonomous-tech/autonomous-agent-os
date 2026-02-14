"use client";

import { Badge } from "@/components/ui/badge";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardStatus, CalloutHandlers } from "@/lib/types";
import { AiCallout } from "./AiCallout";

interface SectionCardProps extends CalloutHandlers {
  title: string;
  icon?: React.ReactNode;
  status: CardStatus;
  optional?: boolean;
  enriching?: boolean;
  children: React.ReactNode;
  className?: string;
}

const STATUS_CONFIG = {
  empty: { label: "Empty", variant: "secondary" as const, icon: null },
  draft: { label: "Draft", variant: "secondary" as const, icon: <Minus className="h-3 w-3" aria-hidden="true" /> },
  done: { label: "Done", variant: "default" as const, icon: <Check className="h-3 w-3" aria-hidden="true" /> },
};

export function SectionCard({
  title,
  icon,
  status,
  optional,
  enriching,
  callouts = [],
  onAcceptCallout,
  onDismissCallout,
  onAnswerCallout,
  children,
  className,
}: SectionCardProps) {
  const statusConfig = STATUS_CONFIG[status];

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-950 p-5 transition-colors",
        status === "done" && "border-zinc-700",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          {optional && status === "empty" && (
            <span className="text-xs text-zinc-500">Optional</span>
          )}
          {enriching && (
            <span className="text-xs text-blue-400 animate-pulse">AI thinking...</span>
          )}
        </div>
        <Badge
          variant={statusConfig.variant}
          className={cn(
            "text-xs gap-1",
            status === "empty" && "opacity-50",
            status === "done" && "bg-green-500/10 text-green-400 border-green-500/20"
          )}
        >
          {statusConfig.icon}
          {statusConfig.label}
        </Badge>
      </div>

      {/* Card content */}
      <div className="space-y-3">
        {children}
      </div>

      {/* AI Callouts */}
      {callouts.length > 0 && (
        <div className="mt-3 space-y-2" aria-live="polite">
          {callouts.map((callout) => (
            <AiCallout
              key={callout.id}
              callout={callout}
              onAccept={() => onAcceptCallout?.(callout.id)}
              onDismiss={() => onDismissCallout?.(callout.id)}
              onAnswer={(answer) => onAnswerCallout?.(callout.id, answer)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
