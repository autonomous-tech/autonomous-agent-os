"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Zap, Plus, Trash2 } from "lucide-react";
import { SectionCard } from "../SectionCard";
import { PillSelector } from "../PillSelector";
import { TagInput } from "../TagInput";
import type {
  Capability,
  Trigger,
  CapabilitiesConfig,
  TriggersConfig,
  CardStatus,
  CalloutHandlers,
} from "@/lib/types";

const ACCESS_OPTIONS = [
  { value: "read-only", label: "Read-only" },
  { value: "write", label: "Write" },
  { value: "full", label: "Full" },
];

const TRIGGER_TYPE_OPTIONS = [
  { value: "message", label: "Message" },
  { value: "event", label: "Event" },
  { value: "schedule", label: "Schedule" },
];

interface WorkflowCardProps extends CalloutHandlers {
  capabilities: CapabilitiesConfig;
  triggers: TriggersConfig;
  onCapabilitiesChange: (config: CapabilitiesConfig) => void;
  onTriggersChange: (config: TriggersConfig) => void;
}

function computeStatus(caps: CapabilitiesConfig, trigs: TriggersConfig): CardStatus {
  const hasCapabilities = caps.tools && caps.tools.length > 0;
  const hasTriggers = trigs.triggers && trigs.triggers.length > 0;
  if (!hasCapabilities && !hasTriggers) return "empty";
  if (hasCapabilities) return "done";
  return "draft";
}

export function WorkflowCard({
  capabilities,
  triggers,
  onCapabilitiesChange,
  onTriggersChange,
  callouts,
  onAcceptCallout,
  onDismissCallout,
  onAnswerCallout,
  enriching,
}: WorkflowCardProps) {
  const tools = capabilities.tools || [];
  const triggerList = triggers.triggers || [];

  function addCapability() {
    onCapabilitiesChange({
      tools: [...tools, { id: crypto.randomUUID(), name: "", access: "read-only", description: "" }],
    });
  }

  function updateCapability(index: number, partial: Partial<Capability>) {
    const updated = tools.map((t, i) => (i === index ? { ...t, ...partial } : t));
    onCapabilitiesChange({ tools: updated });
  }

  function removeCapability(index: number) {
    onCapabilitiesChange({ tools: tools.filter((_, i) => i !== index) });
  }

  function addTrigger() {
    onTriggersChange({
      triggers: [...triggerList, { id: crypto.randomUUID(), type: "message", description: "" }],
    });
  }

  function updateTrigger(index: number, partial: Partial<Trigger>) {
    const updated = triggerList.map((t, i) => (i === index ? { ...t, ...partial } : t));
    onTriggersChange({ triggers: updated });
  }

  function removeTrigger(index: number) {
    onTriggersChange({ triggers: triggerList.filter((_, i) => i !== index) });
  }

  return (
    <SectionCard
      title="Workflow"
      icon={<Zap className="h-4 w-4 text-zinc-400" />}
      status={computeStatus(capabilities, triggers)}
      enriching={enriching}
      callouts={callouts}
      onAcceptCallout={onAcceptCallout}
      onDismissCallout={onDismissCallout}
      onAnswerCallout={onAnswerCallout}
    >
      {/* Capabilities */}
      <div>
        <label className="text-xs font-medium text-zinc-400 mb-2 block">Capabilities</label>
        <div className="space-y-3">
          {tools.map((tool, i) => (
            <CapabilityRow
              key={tool.id || i}
              capability={tool}
              onChange={(partial) => updateCapability(i, partial)}
              onRemove={() => removeCapability(i)}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-7 text-xs text-zinc-400 hover:text-zinc-200"
          onClick={addCapability}
        >
          <Plus className="h-3 w-3 mr-1" /> Add Capability
        </Button>
      </div>

      {/* Triggers */}
      <div className="pt-2 border-t border-zinc-800/50">
        <label className="text-xs font-medium text-zinc-400 mb-2 block">Triggers</label>
        <div className="space-y-3">
          {triggerList.map((trigger, i) => (
            <TriggerRow
              key={trigger.id || i}
              trigger={trigger}
              onChange={(partial) => updateTrigger(i, partial)}
              onRemove={() => removeTrigger(i)}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-7 text-xs text-zinc-400 hover:text-zinc-200"
          onClick={addTrigger}
        >
          <Plus className="h-3 w-3 mr-1" /> Add Trigger
        </Button>
      </div>
    </SectionCard>
  );
}

function CapabilityRow({
  capability,
  onChange,
  onRemove,
}: {
  capability: Capability;
  onChange: (partial: Partial<Capability>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/50 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <Input
            value={capability.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Capability name"
            className="h-7 text-xs bg-zinc-900 border-zinc-800"
          />
          <PillSelector
            value={capability.access}
            options={ACCESS_OPTIONS}
            onChange={(access) => onChange({ access: access as Capability["access"] })}
          />
          <Input
            value={capability.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="What does this capability do?"
            className="h-7 text-xs bg-zinc-900 border-zinc-800"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove capability ${capability.name || ""}`}
          className="text-zinc-500 hover:text-red-400 mt-1 shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function TriggerRow({
  trigger,
  onChange,
  onRemove,
}: {
  trigger: Trigger;
  onChange: (partial: Partial<Trigger>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/50 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <PillSelector
            value={trigger.type}
            options={TRIGGER_TYPE_OPTIONS}
            onChange={(type) => onChange({ type: type as Trigger["type"] })}
          />
          <Input
            value={trigger.name || ""}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Trigger name"
            className="h-7 text-xs bg-zinc-900 border-zinc-800"
          />
          <Input
            value={trigger.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="When does this trigger activate?"
            className="h-7 text-xs bg-zinc-900 border-zinc-800"
          />
          {trigger.type === "message" && (
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Channels</label>
              <TagInput
                values={trigger.channels || []}
                onChange={(channels) => onChange({ channels })}
                placeholder="Add channel"
              />
            </div>
          )}
          {trigger.type === "event" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Source</label>
                <Input
                  value={trigger.source || ""}
                  onChange={(e) => onChange({ source: e.target.value })}
                  placeholder="Event source"
                  className="h-7 text-xs bg-zinc-900 border-zinc-800"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Action</label>
                <Input
                  value={trigger.action || ""}
                  onChange={(e) => onChange({ action: e.target.value })}
                  placeholder="Action to take"
                  className="h-7 text-xs bg-zinc-900 border-zinc-800"
                />
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove trigger ${trigger.name || ""}`}
          className="text-zinc-500 hover:text-red-400 mt-1 shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
