"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TriggerData {
  type: string;
  description: string;
  channels?: string[];
}

interface TriggerRowProps {
  trigger: TriggerData;
  onChange?: (trigger: TriggerData) => void;
  onDelete?: () => void;
  editing?: boolean;
}

const typeColors: Record<string, string> = {
  message: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  event: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  schedule: "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

export function TriggerRow({
  trigger,
  onChange,
  onDelete,
  editing = false,
}: TriggerRowProps) {
  if (editing) {
    return (
      <div className="flex items-start gap-1.5 rounded border p-2">
        <div className="flex-1 space-y-1.5">
          <select
            value={trigger.type}
            onChange={(e) =>
              onChange?.({ ...trigger, type: e.target.value })
            }
            className="h-7 w-full rounded-md border bg-background px-2 text-xs"
          >
            <option value="message">message</option>
            <option value="event">event</option>
            <option value="schedule">schedule</option>
          </select>
          <Input
            value={trigger.description}
            onChange={(e) =>
              onChange?.({ ...trigger, description: e.target.value })
            }
            className="h-7 text-xs"
            placeholder="Trigger description"
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
    );
  }

  return (
    <div className="flex items-start gap-2">
      <Badge
        className={cn(
          "text-[10px] shrink-0 mt-0.5 border",
          typeColors[trigger.type] || typeColors.message
        )}
      >
        {trigger.type}
      </Badge>
      <div className="flex-1 min-w-0">
        <span className="text-xs text-muted-foreground">
          {trigger.description}
        </span>
        {trigger.channels && trigger.channels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {trigger.channels.map((channel) => (
              <Badge
                key={channel}
                variant="outline"
                className="text-[10px] px-1.5 py-0"
              >
                {channel}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
