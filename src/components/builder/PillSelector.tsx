"use client";

import { cn } from "@/lib/utils";

interface PillOption {
  value: string;
  label?: string;
}

interface PillSelectorProps {
  value: string;
  options: (string | PillOption)[];
  onChange: (value: string) => void;
  className?: string;
}

export function PillSelector({
  value,
  options,
  onChange,
  className,
}: PillSelectorProps) {
  const normalized = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : { value: o.value, label: o.label || o.value }
  );

  return (
    <div role="radiogroup" className={cn("flex flex-wrap gap-1.5", className)}>
      {normalized.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            option.value === value
              ? "bg-zinc-100 text-zinc-900"
              : "bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
