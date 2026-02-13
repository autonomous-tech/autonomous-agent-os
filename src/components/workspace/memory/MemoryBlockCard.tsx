"use client";

import { useState } from "react";
import { MemoryBlock, useMemoryStore } from "@/stores/memory-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Save, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface MemoryBlockCardProps {
  block: MemoryBlock;
  lettaAgentId: string;
  onUpdate?: () => void;
}

export function MemoryBlockCard({ block, lettaAgentId, onUpdate }: MemoryBlockCardProps) {
  const { isEditing, editDraft, startEditing, updateDraft, cancelEditing, setLoading } =
    useMemoryStore();

  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const isCurrentlyEditing = isEditing && editDraft !== "";
  const valueLength = block.value.length;
  const usagePercent = (valueLength / block.limit) * 100;
  const shouldTruncate = valueLength > 200;

  const handleEdit = () => {
    startEditing(block.value);
  };

  const handleCancel = () => {
    cancelEditing();
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setLoading(true);

      const response = await fetch(
        `/api/letta/agents/${lettaAgentId}/memory/${block.label}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: editDraft }),
        }
      );

      if (!response.ok) throw new Error("Failed to update memory");

      cancelEditing();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Error saving memory block:", err);
      alert("Failed to save memory block");
    } finally {
      setSaving(false);
      setLoading(false);
    }
  };

  const displayValue = shouldTruncate && !expanded ? block.value.slice(0, 200) + "..." : block.value;

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-medium text-zinc-100">
              {block.label}
            </CardTitle>
            {block.description && (
              <p className="mt-1 text-xs text-zinc-500">{block.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {block.readOnly && (
              <Badge variant="outline" className="text-xs">
                Read-only
              </Badge>
            )}
            {!block.readOnly && !isCurrentlyEditing && (
              <Button variant="ghost" size="icon-xs" onClick={handleEdit}>
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Usage Bar */}
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Usage</span>
            <span>
              {valueLength} / {block.limit}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={cn(
                "h-full transition-all",
                usagePercent > 90
                  ? "bg-red-500"
                  : usagePercent > 70
                    ? "bg-yellow-500"
                    : "bg-green-500"
              )}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {isCurrentlyEditing ? (
          // Edit Mode
          <div className="space-y-2">
            <Textarea
              value={editDraft}
              onChange={(e) => updateDraft(e.target.value)}
              className="min-h-[120px] bg-zinc-950 text-sm text-zinc-100"
              maxLength={block.limit}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
                <X className="mr-1 h-3 w-3" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save className="mr-1 h-3 w-3" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          // View Mode
          <div>
            <p className="whitespace-pre-wrap text-sm text-zinc-300">{displayValue}</p>

            {shouldTruncate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="mt-2 h-auto p-0 text-xs text-zinc-500 hover:text-zinc-400"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="mr-1 h-3 w-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-3 w-3" />
                    Show more
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
