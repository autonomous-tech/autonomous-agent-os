"use client";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface QuoteBlockProps {
  value: string;
  onChange?: (val: string) => void;
  editing?: boolean;
  placeholder?: string;
}

export function QuoteBlock({
  value,
  onChange,
  editing = false,
  placeholder,
}: QuoteBlockProps) {
  if (editing) {
    return (
      <div className="bg-accent/20 rounded-lg p-3">
        <Textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="text-sm italic min-h-[60px] border-none shadow-none p-0 focus-visible:ring-0 bg-transparent resize-none"
        />
      </div>
    );
  }

  return (
    <div className="bg-accent/20 rounded-lg p-3">
      <p
        className={cn(
          "text-sm italic text-muted-foreground",
          !value && "opacity-60"
        )}
      >
        {value ? (
          <>
            &ldquo;{value}&rdquo;
          </>
        ) : (
          placeholder || "No greeting set"
        )}
      </p>
    </div>
  );
}
