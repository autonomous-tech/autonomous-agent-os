"use client";

import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulletListProps {
  items: string[];
  onChange?: (items: string[]) => void;
  editing?: boolean;
  placeholder?: string;
  variant?: "default" | "negative";
}

export function BulletList({
  items,
  onChange,
  editing = false,
  placeholder,
  variant = "default",
}: BulletListProps) {
  if (editing) {
    return (
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              value={item}
              onChange={(e) => {
                const updated = [...items];
                updated[i] = e.target.value;
                onChange?.(updated);
              }}
              className="h-7 text-xs"
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={() => onChange?.(items.filter((_, idx) => idx !== i))}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange?.([...items, ""])}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add item
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-0.5">
      {items.map((item, i) => (
        <li
          key={i}
          className={cn(
            "text-xs flex items-start gap-1.5",
            variant === "negative"
              ? "text-red-400/80"
              : "text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "mt-1.5 h-1 w-1 shrink-0 rounded-full",
              variant === "negative" ? "bg-red-400/80" : "bg-foreground/40"
            )}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
