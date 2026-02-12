"use client";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface TextBlockProps {
  value: string;
  onChange?: (val: string) => void;
  editing?: boolean;
  placeholder?: string;
}

export function TextBlock({
  value,
  onChange,
  editing = false,
  placeholder,
}: TextBlockProps) {
  if (editing) {
    return (
      <div className="border-l-2 border-primary/30 pl-3">
        <Textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="text-sm min-h-[60px] border-none shadow-none p-0 focus-visible:ring-0 bg-transparent resize-none"
        />
      </div>
    );
  }

  return (
    <div className="border-l-2 border-primary/30 pl-3">
      <p
        className={cn(
          "text-sm text-muted-foreground",
          !value && "italic"
        )}
      >
        {value || placeholder || "Not set"}
      </p>
    </div>
  );
}
