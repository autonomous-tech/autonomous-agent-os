"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { TestChat } from "@/components/builder/TestChat";
import {
  Play,
  Download,
  Loader2,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import type {
  AgentConfig,
  StageData,
  StageName,
  Capability,
} from "@/lib/types";
import { getTools, getTriggers } from "@/lib/types";

// ── Editable list component ──────────────────────────────────────────

function EditableList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input
            value={item}
            onChange={(e) => {
              const updated = [...items];
              updated[i] = e.target.value;
              onChange(updated);
            }}
            className="h-7 text-xs"
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3 w-3" /> Add item
      </button>
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────

interface SectionProps {
  title: string;
  status: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
  editContent: React.ReactNode;
}

function Section({
  title,
  children,
  editContent,
  status,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
}: SectionProps) {
  if (isEditing) {
    return (
      <div className="rounded-lg p-3 ring-1 ring-primary/30 bg-accent/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCancel}>
              <X className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
            <Button size="sm" className="h-7 px-2" onClick={onSave}>
              <Check className="h-3.5 w-3.5 mr-1" /> Save
            </Button>
          </div>
        </div>
        {editContent}
      </div>
    );
  }

  return (
    <div
      className="group cursor-pointer rounded-lg p-3 transition-colors hover:bg-accent/30"
      onClick={onStartEdit}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          {status !== "incomplete" && (
            <Badge
              variant={status === "approved" ? "default" : "secondary"}
              className="text-xs"
            >
              {status}
            </Badge>
          )}
          <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────

interface PreviewPaneProps {
  projectId: string;
  config: AgentConfig;
  stages: StageData;
  onExport: () => void;
  isExporting: boolean;
  onStageSelect: (stage: StageName) => void;
  onConfigUpdate?: (stage: StageName, data: Record<string, unknown>) => void;
}

export function PreviewPane({
  projectId,
  config,
  stages,
  onExport,
  isExporting,
  onStageSelect,
  onConfigUpdate,
}: PreviewPaneProps) {
  const [showTestChat, setShowTestChat] = useState(false);
  const [editingSection, setEditingSection] = useState<StageName | null>(null);

  // Draft state for each section while editing
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  const hasAnyStageCompleted = Object.values(stages).some(
    (s) => s.status === "draft" || s.status === "approved"
  );

  function startEdit(stage: StageName) {
    // Clone the current config section as draft
    const current = config[stage as keyof AgentConfig] || {};
    setDraft(JSON.parse(JSON.stringify(current)));
    setEditingSection(stage);
  }

  function cancelEdit() {
    setEditingSection(null);
    setDraft({});
  }

  function saveEdit() {
    if (!editingSection || !onConfigUpdate) return;
    onConfigUpdate(editingSection, draft);
    setEditingSection(null);
    setDraft({});
  }

  if (showTestChat) {
    return (
      <TestChat
        projectId={projectId}
        config={config}
        onExit={() => setShowTestChat(false)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-6">
          {/* Agent header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              {config.identity?.emoji && (
                <span className="text-2xl">{config.identity.emoji}</span>
              )}
              <h2 className="text-xl font-bold">
                {config.identity?.name || "Untitled Agent"}
              </h2>
            </div>
            {config.mission?.description && (
              <p className="text-sm text-muted-foreground">
                {config.mission.description}
              </p>
            )}
          </div>

          <Separator className="mb-6" />

          {/* Sections */}
          <div className="flex flex-col gap-2">
            {/* ── Mission ── */}
            <Section
              title="Mission"
              status={stages.mission?.status || "incomplete"}
              isEditing={editingSection === "mission"}
              onStartEdit={() => startEdit("mission")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              editContent={
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Description
                    </label>
                    <Textarea
                      value={(draft.description as string) || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, description: e.target.value })
                      }
                      className="text-xs min-h-[60px]"
                      placeholder="What does this agent do?"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Tasks
                    </label>
                    <EditableList
                      items={(draft.tasks as string[]) || []}
                      onChange={(tasks) => setDraft({ ...draft, tasks })}
                      placeholder="Task description"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Exclusions
                    </label>
                    <EditableList
                      items={(draft.exclusions as string[]) || []}
                      onChange={(exclusions) =>
                        setDraft({ ...draft, exclusions })
                      }
                      placeholder="What the agent should NOT do"
                    />
                  </div>
                </div>
              }
            >
              {config.mission?.description ? (
                <div className="space-y-2">
                  <p className="text-sm">{config.mission.description}</p>
                  {config.mission.tasks && config.mission.tasks.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        Tasks:
                      </span>
                      <ul className="mt-1 space-y-0.5">
                        {config.mission.tasks.map((task, i) => (
                          <li
                            key={i}
                            className="text-xs text-muted-foreground flex items-start gap-1.5"
                          >
                            <span className="text-foreground/60 mt-0.5">-</span>
                            <span>{task}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {config.mission.exclusions &&
                    config.mission.exclusions.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">
                          Exclusions:
                        </span>
                        <ul className="mt-1 space-y-0.5">
                          {config.mission.exclusions.map((ex, i) => (
                            <li
                              key={i}
                              className="text-xs text-red-400/80 flex items-start gap-1.5"
                            >
                              <span className="mt-0.5">-</span>
                              <span>{ex}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Not configured
                </p>
              )}
            </Section>

            <Separator />

            {/* ── Identity ── */}
            <Section
              title="Identity"
              status={stages.identity?.status || "incomplete"}
              isEditing={editingSection === "identity"}
              onStartEdit={() => startEdit("identity")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              editContent={
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Name
                      </label>
                      <Input
                        value={(draft.name as string) || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, name: e.target.value })
                        }
                        className="h-7 text-xs"
                        placeholder="Agent name"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Emoji
                      </label>
                      <Input
                        value={(draft.emoji as string) || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, emoji: e.target.value })
                        }
                        className="h-7 text-xs"
                        placeholder="e.g. 🤖"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Tone
                    </label>
                    <Input
                      value={(draft.tone as string) || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, tone: e.target.value })
                      }
                      className="h-7 text-xs"
                      placeholder="e.g. professional, friendly"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Vibe / Personality
                    </label>
                    <Textarea
                      value={(draft.vibe as string) || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, vibe: e.target.value })
                      }
                      className="text-xs min-h-[50px]"
                      placeholder="Describe the agent's personality"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Greeting
                    </label>
                    <Textarea
                      value={(draft.greeting as string) || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, greeting: e.target.value })
                      }
                      className="text-xs min-h-[50px]"
                      placeholder="Sample greeting message"
                    />
                  </div>
                </div>
              }
            >
              {config.identity?.name ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {config.identity.name}
                    </span>
                    {config.identity.emoji && (
                      <span>{config.identity.emoji}</span>
                    )}
                  </div>
                  {config.identity.tone && (
                    <p className="text-xs text-muted-foreground">
                      Tone: {config.identity.tone}
                    </p>
                  )}
                  {config.identity.vibe && (
                    <p className="text-xs text-muted-foreground">
                      {config.identity.vibe}
                    </p>
                  )}
                  {config.identity.greeting && (
                    <p className="text-xs text-muted-foreground italic mt-1">
                      &quot;{config.identity.greeting}&quot;
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Not configured
                </p>
              )}
            </Section>

            <Separator />

            {/* ── Capabilities ── */}
            <Section
              title="Capabilities"
              status={stages.capabilities?.status || "incomplete"}
              isEditing={editingSection === "capabilities"}
              onStartEdit={() => startEdit("capabilities")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              editContent={
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Tools
                  </label>
                  {((draft.tools as Capability[]) || []).map((tool, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5 rounded border p-2"
                    >
                      <div className="flex-1 space-y-1.5">
                        <div className="grid grid-cols-2 gap-1.5">
                          <Input
                            value={tool.name}
                            onChange={(e) => {
                              const tools = [
                                ...((draft.tools as Capability[]) || []),
                              ];
                              tools[i] = { ...tools[i], name: e.target.value };
                              setDraft({ ...draft, tools });
                            }}
                            className="h-7 text-xs"
                            placeholder="Tool name"
                          />
                          <select
                            value={tool.access}
                            onChange={(e) => {
                              const tools = [
                                ...((draft.tools as Capability[]) || []),
                              ];
                              tools[i] = {
                                ...tools[i],
                                access: e.target.value as Capability["access"],
                              };
                              setDraft({ ...draft, tools });
                            }}
                            className="h-7 rounded-md border bg-background px-2 text-xs"
                          >
                            <option value="read-only">read-only</option>
                            <option value="write">write</option>
                            <option value="full">full</option>
                          </select>
                        </div>
                        <Input
                          value={tool.description}
                          onChange={(e) => {
                            const tools = [
                              ...((draft.tools as Capability[]) || []),
                            ];
                            tools[i] = {
                              ...tools[i],
                              description: e.target.value,
                            };
                            setDraft({ ...draft, tools });
                          }}
                          className="h-7 text-xs"
                          placeholder="Description"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const tools = (
                            (draft.tools as Capability[]) || []
                          ).filter((_, idx) => idx !== i);
                          setDraft({ ...draft, tools });
                        }}
                        className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const tools = [
                        ...((draft.tools as Capability[]) || []),
                        {
                          name: "",
                          access: "read-only" as const,
                          description: "",
                        },
                      ];
                      setDraft({ ...draft, tools });
                    }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" /> Add tool
                  </button>
                </div>
              }
            >
              {getTools(config).length > 0 ? (
                <div className="space-y-1.5">
                  {getTools(config).map((tool, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0 mt-0.5"
                      >
                        {tool.access}
                      </Badge>
                      <div>
                        <span className="text-xs font-medium">{tool.name}</span>
                        <p className="text-xs text-muted-foreground">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Not configured
                </p>
              )}
            </Section>

            <Separator />

            {/* ── Memory ── */}
            <Section
              title="Memory"
              status={stages.memory?.status || "incomplete"}
              isEditing={editingSection === "memory"}
              onStartEdit={() => startEdit("memory")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              editContent={
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Strategy
                    </label>
                    <select
                      value={(draft.strategy as string) || "conversational"}
                      onChange={(e) =>
                        setDraft({ ...draft, strategy: e.target.value })
                      }
                      className="h-7 w-full rounded-md border bg-background px-2 text-xs"
                    >
                      <option value="conversational">Conversational</option>
                      <option value="task-based">Task-based</option>
                      <option value="minimal">Minimal</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Remember
                    </label>
                    <EditableList
                      items={(draft.remember as string[]) || []}
                      onChange={(remember) =>
                        setDraft({ ...draft, remember })
                      }
                      placeholder="What to remember"
                    />
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={(draft.daily_logs as boolean) || false}
                        onChange={(e) =>
                          setDraft({ ...draft, daily_logs: e.target.checked })
                        }
                        className="rounded"
                      />
                      Daily logs
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={(draft.curated_memory as boolean) || false}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            curated_memory: e.target.checked,
                          })
                        }
                        className="rounded"
                      />
                      Curated memory
                    </label>
                  </div>
                </div>
              }
            >
              {config.memory?.strategy ? (
                <div className="space-y-1">
                  <p className="text-xs">
                    Strategy:{" "}
                    <span className="font-medium">{config.memory.strategy}</span>
                  </p>
                  {config.memory.remember &&
                    config.memory.remember.length > 0 && (
                      <ul className="space-y-0.5">
                        {config.memory.remember.map((item, i) => (
                          <li
                            key={i}
                            className="text-xs text-muted-foreground"
                          >
                            - {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {config.memory.daily_logs && <span>Daily logs: on</span>}
                    {config.memory.curated_memory && (
                      <span>Curated: on</span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Not configured
                </p>
              )}
            </Section>

            <Separator />

            {/* ── Triggers ── */}
            <Section
              title="Triggers"
              status={stages.triggers?.status || "incomplete"}
              isEditing={editingSection === "triggers"}
              onStartEdit={() => startEdit("triggers")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              editContent={
                <div className="space-y-2">
                  {(
                    (draft.triggers as Array<{
                      type: string;
                      description: string;
                    }>) || []
                  ).map((trigger, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5 rounded border p-2"
                    >
                      <div className="flex-1 space-y-1.5">
                        <select
                          value={trigger.type}
                          onChange={(e) => {
                            const triggers = [
                              ...((draft.triggers as Array<{
                                type: string;
                                description: string;
                              }>) || []),
                            ];
                            triggers[i] = {
                              ...triggers[i],
                              type: e.target.value,
                            };
                            setDraft({ ...draft, triggers });
                          }}
                          className="h-7 w-full rounded-md border bg-background px-2 text-xs"
                        >
                          <option value="message">message</option>
                          <option value="event">event</option>
                          <option value="schedule">schedule</option>
                        </select>
                        <Input
                          value={trigger.description}
                          onChange={(e) => {
                            const triggers = [
                              ...((draft.triggers as Array<{
                                type: string;
                                description: string;
                              }>) || []),
                            ];
                            triggers[i] = {
                              ...triggers[i],
                              description: e.target.value,
                            };
                            setDraft({ ...draft, triggers });
                          }}
                          className="h-7 text-xs"
                          placeholder="Trigger description"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const triggers = (
                            (draft.triggers as Array<{
                              type: string;
                              description: string;
                            }>) || []
                          ).filter((_, idx) => idx !== i);
                          setDraft({ ...draft, triggers });
                        }}
                        className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const triggers = [
                        ...((draft.triggers as Array<{
                          type: string;
                          description: string;
                        }>) || []),
                        { type: "message", description: "" },
                      ];
                      setDraft({ ...draft, triggers });
                    }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" /> Add trigger
                  </button>
                </div>
              }
            >
              {getTriggers(config).length > 0 ? (
                <div className="space-y-1.5">
                  {getTriggers(config).map((trigger, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0 mt-0.5"
                      >
                        {trigger.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {trigger.description}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Not configured
                </p>
              )}
            </Section>

            <Separator />

            {/* ── Guardrails ── */}
            <Section
              title="Guardrails"
              status={stages.guardrails?.status || "incomplete"}
              isEditing={editingSection === "guardrails"}
              onStartEdit={() => startEdit("guardrails")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              editContent={
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Behavioral Rules
                    </label>
                    <EditableList
                      items={(draft.behavioral as string[]) || []}
                      onChange={(behavioral) =>
                        setDraft({ ...draft, behavioral })
                      }
                      placeholder="Rule or constraint"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Prompt Injection Defense
                    </label>
                    <select
                      value={
                        (draft.prompt_injection_defense as string) || "strict"
                      }
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          prompt_injection_defense: e.target.value,
                        })
                      }
                      className="h-7 w-full rounded-md border bg-background px-2 text-xs"
                    >
                      <option value="strict">Strict</option>
                      <option value="moderate">Moderate</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>
              }
            >
              {config.guardrails?.behavioral &&
              config.guardrails.behavioral.length > 0 ? (
                <div className="space-y-1.5">
                  <ul className="space-y-0.5">
                    {config.guardrails.behavioral.map((rule, i) => (
                      <li
                        key={i}
                        className="text-xs text-muted-foreground"
                      >
                        - {rule}
                      </li>
                    ))}
                  </ul>
                  {config.guardrails.prompt_injection_defense && (
                    <p className="text-xs">
                      Prompt injection defense:{" "}
                      <span className="font-medium">
                        {config.guardrails.prompt_injection_defense}
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Not configured
                </p>
              )}
            </Section>
          </div>
        </div>
      </ScrollArea>

      {/* Action buttons */}
      <div className="border-t p-4 flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setShowTestChat(true)}
          disabled={!hasAnyStageCompleted}
        >
          <Play className="h-4 w-4 mr-2" />
          Try It
        </Button>
        <Button
          className="flex-1"
          onClick={onExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
        </Button>
      </div>
    </div>
  );
}
