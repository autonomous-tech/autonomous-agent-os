"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TagInput({
  values,
  onChange,
  placeholder = "Type and press Enter",
  className,
}: TagInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(text: string) {
    const trimmed = text.trim();
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    setInput("");
  }

  function removeTag(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && values.length > 0) {
      removeTag(values.length - 1);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 min-h-[36px] cursor-text",
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {values.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200 max-w-[200px]"
        >
          <span className="truncate">{tag}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(i);
            }}
            aria-label={`Remove ${tag}`}
            className="text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (input.trim()) addTag(input);
        }}
        placeholder={values.length === 0 ? placeholder : ""}
        className="h-6 min-w-[120px] flex-1 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
