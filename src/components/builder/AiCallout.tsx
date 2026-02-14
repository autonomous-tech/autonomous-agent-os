"use client";

import { Button } from "@/components/ui/button";
import { X, Lightbulb, Sparkles, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AiCallout as AiCalloutData,
  EnrichmentSuggestion,
  EnrichmentIdea,
  EnrichmentQuestion,
} from "@/lib/types";

interface AiCalloutProps {
  callout: AiCalloutData;
  onAccept?: () => void;
  onDismiss: () => void;
  onAnswer?: (answer: string) => void;
}

const STYLES = {
  suggestion: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    icon: Sparkles,
    iconColor: "text-amber-400",
    label: "Suggestion",
  },
  idea: {
    border: "border-violet-500/30",
    bg: "bg-violet-500/5",
    icon: Lightbulb,
    iconColor: "text-violet-400",
    label: "Idea",
  },
  question: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    icon: HelpCircle,
    iconColor: "text-blue-400",
    label: "Question",
  },
} as const;

export function AiCallout({
  callout,
  onAccept,
  onDismiss,
  onAnswer,
}: AiCalloutProps) {
  const style = STYLES[callout.type];
  const Icon = style.icon;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 mt-2",
        style.border,
        style.bg
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", style.iconColor)} />
        <div className="flex-1 min-w-0">
          {callout.type === "suggestion" && (
            <SuggestionContent
              data={callout.data as EnrichmentSuggestion}
              onAccept={onAccept}
              onDismiss={onDismiss}
            />
          )}
          {callout.type === "idea" && (
            <IdeaContent
              data={callout.data as EnrichmentIdea}
              onAccept={onAccept}
              onDismiss={onDismiss}
            />
          )}
          {callout.type === "question" && (
            <QuestionContent
              data={callout.data as EnrichmentQuestion}
              onAnswer={onAnswer}
              onDismiss={onDismiss}
            />
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-zinc-500 hover:text-zinc-300 shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function SuggestionContent({
  data,
  onAccept,
  onDismiss,
}: {
  data: EnrichmentSuggestion;
  onAccept?: () => void;
  onDismiss: () => void;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-300 mb-1">{data.reason}</p>
      <p className="text-sm text-zinc-100 bg-zinc-800/50 rounded px-2 py-1.5 mb-2">
        {data.improved}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={onAccept}>
          Accept
        </Button>
        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function IdeaContent({
  data,
  onAccept,
  onDismiss,
}: {
  data: EnrichmentIdea;
  onAccept?: () => void;
  onDismiss: () => void;
}) {
  const displayValue = typeof data.value === "string"
    ? data.value
    : typeof data.value === "object" && data.value !== null && "name" in data.value
      ? (data.value as { name: string; description?: string }).name +
        ((data.value as { description?: string }).description ? ` — ${(data.value as { description?: string }).description}` : "")
      : JSON.stringify(data.value);
  return (
    <div>
      <p className="text-xs text-zinc-300 mb-1">{data.reason}</p>
      <p className="text-sm text-zinc-100 mb-2">{displayValue}</p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={onAccept}>
          Add This
        </Button>
        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={onDismiss}>
          Skip
        </Button>
      </div>
    </div>
  );
}

function QuestionContent({
  data,
  onAnswer,
  onDismiss,
}: {
  data: EnrichmentQuestion;
  onAnswer?: (answer: string) => void;
  onDismiss: () => void;
}) {
  return (
    <div>
      <p className="text-sm text-zinc-100 mb-2">{data.question}</p>
      <div className="flex flex-wrap gap-1.5 mb-1">
        {data.options.map((option) => (
          <Button
            key={option}
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onAnswer?.(option)}
          >
            {option}
          </Button>
        ))}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        Skip question
      </button>
    </div>
  );
}
