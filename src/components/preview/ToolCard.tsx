"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolData {
  name: string;
  access: "read-only" | "write" | "full";
  description: string;
}

interface ToolCardProps {
  tool: ToolData;
  onChange?: (tool: ToolData) => void;
  onDelete?: () => void;
  editing?: boolean;
}

const accessColors: Record<
  ToolData["access"],
  string
> = {
  "read-only": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  write: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  full: "bg-green-500/15 text-green-400 border-green-500/20",
};

export function ToolCard({
  tool,
  onChange,
  onDelete,
  editing = false,
}: ToolCardProps) {
  if (editing) {
    return (
      <div className="rounded-lg border p-3 space-y-1.5">
        <div className="flex items-start gap-1.5">
          <div className="flex-1 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                value={tool.name}
                onChange={(e) =>
                  onChange?.({ ...tool, name: e.target.value })
                }
                className="h-7 text-xs"
                placeholder="Tool name"
              />
              <select
                value={tool.access}
                onChange={(e) =>
                  onChange?.({
                    ...tool,
                    access: e.target.value as ToolData["access"],
                  })
                }
                className="h-7 rounded-md border bg-background px-2 text-xs"
              >
                <option value="read-only">read-only</option>
                <option value="write">write</option>
                <option value="full">full</option>
              </select>
            </div>
            <Input
              value={tool.description}
              onChange={(e) =>
                onChange?.({ ...tool, description: e.target.value })
              }
              className="h-7 text-xs"
              placeholder="Description"
            />
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{tool.name}</span>
        <Badge
          className={cn(
            "text-[10px] border",
            accessColors[tool.access]
          )}
        >
          {tool.access}
        </Badge>
      </div>
      {tool.description && (
        <p className="text-xs text-muted-foreground mt-1">
          {tool.description}
        </p>
      )}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground mt-2 group/trigger">
          <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]/trigger:rotate-90" />
          Settings
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p className="text-[10px] text-muted-foreground/60 italic mt-1.5 pl-4">
            No integrations configured
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
