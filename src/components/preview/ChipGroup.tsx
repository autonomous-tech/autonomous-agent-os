"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ChipGroupProps {
  value: string;
  options?: string[];
  onChange?: (val: string) => void;
  editing?: boolean;
}

export function ChipGroup({
  value,
  options,
  onChange,
  editing = false,
}: ChipGroupProps) {
  if (editing && options && options.length > 0) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <Badge
            key={option}
            variant={option === value ? "default" : "outline"}
            className={cn(
              "text-xs cursor-pointer transition-colors",
              option !== value && "hover:bg-accent"
            )}
            onClick={() => onChange?.(option)}
          >
            {option}
          </Badge>
        ))}
      </div>
    );
  }

  if (!value) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="secondary" className="text-xs">
        {value}
      </Badge>
    </div>
  );
}
