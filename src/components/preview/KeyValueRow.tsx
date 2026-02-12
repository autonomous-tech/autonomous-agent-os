"use client";

import { Input } from "@/components/ui/input";

interface KeyValueRowProps {
  label: string;
  value: string | number;
  onChange?: (val: string) => void;
  editing?: boolean;
  type?: "text" | "number";
}

export function KeyValueRow({
  label,
  value,
  onChange,
  editing = false,
  type = "text",
}: KeyValueRowProps) {
  if (editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground shrink-0">{label}</span>
        <Input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          type={type}
          className="h-7 text-xs w-24 text-right"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}
