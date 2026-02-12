"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { TestChat } from "@/components/builder/TestChat";
import {
  Play,
  Download,
  Loader2,
  Pencil,
  Check,
  X,
  ChevronDown,
} from "lucide-react";
import {
  MissionSection,
  IdentitySection,
  CapabilitiesSection,
  MemorySection,
  TriggersSection,
  GuardrailsSection,
} from "@/components/preview";
import type { AgentConfig, StageData, StageName } from "@/lib/types";
import { getTools, getTriggers } from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Collapsible Section wrapper ─────────────────────────────────────

interface SectionProps {
  title: string;
  status: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  defaultOpen?: boolean;
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
  defaultOpen,
}: SectionProps) {
  if (isEditing) {
    return (
      <div className="rounded-lg p-3 ring-1 ring-primary/30 bg-accent/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={onCancel}
            >
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

  const isOpen = defaultOpen ?? status !== "incomplete";

  return (
    <Collapsible defaultOpen={isOpen}>
      <div className="group rounded-lg p-3 transition-colors hover:bg-accent/30">
        <div className="flex items-center justify-between mb-2">
          <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-semibold">
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=closed]:rotate-[-90deg]" />
            {title}
          </CollapsibleTrigger>
          <div className="flex items-center gap-2">
            {status !== "incomplete" && (
              <Badge
                variant={status === "approved" ? "default" : "secondary"}
                className="text-xs"
              >
                {status}
              </Badge>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit();
              }}
              className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <CollapsibleContent>{children}</CollapsibleContent>
      </div>
    </Collapsible>
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
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  const hasAnyStageCompleted = Object.values(stages).some(
    (s) => s.status === "draft" || s.status === "approved"
  );

  function startEdit(stage: StageName) {
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
            <Section
              title="Mission"
              status={stages.mission?.status || "incomplete"}
              isEditing={editingSection === "mission"}
              onStartEdit={() => startEdit("mission")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              editContent={
                <MissionSection
                  config={config.mission || {}}
                  draft={draft}
                  editing={true}
                  onDraftChange={setDraft}
                />
              }
            >
              <MissionSection
                config={config.mission || {}}
                draft={draft}
                editing={false}
                onDraftChange={setDraft}
              />
            </Section>

            <Separator />

            <Section
              title="Identity"
              status={stages.identity?.status || "incomplete"}
              isEditing={editingSection === "identity"}
              onStartEdit={() => startEdit("identity")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              editContent={
                <IdentitySection
                  config={config.identity || {}}
                  draft={draft}
                  editing={true}
                  onDraftChange={setDraft}
                />
              }
            >
              <IdentitySection
                config={config.identity || {}}
                draft={draft}
                editing={false}
                onDraftChange={setDraft}
              />
            </Section>

            <Separator />

            <Section
              title="Capabilities"
              status={stages.capabilities?.status || "incomplete"}
              isEditing={editingSection === "capabilities"}
              onStartEdit={() => startEdit("capabilities")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              editContent={
                <CapabilitiesSection
                  config={config.capabilities || {}}
                  tools={getTools(config)}
                  draft={draft}
                  editing={true}
                  onDraftChange={setDraft}
                />
              }
            >
              <CapabilitiesSection
                config={config.capabilities || {}}
                tools={getTools(config)}
                draft={draft}
                editing={false}
                onDraftChange={setDraft}
              />
            </Section>

            <Separator />

            <Section
              title="Memory"
              status={stages.memory?.status || "incomplete"}
              isEditing={editingSection === "memory"}
              onStartEdit={() => startEdit("memory")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              editContent={
                <MemorySection
                  config={config.memory || {}}
                  draft={draft}
                  editing={true}
                  onDraftChange={setDraft}
                />
              }
            >
              <MemorySection
                config={config.memory || {}}
                draft={draft}
                editing={false}
                onDraftChange={setDraft}
              />
            </Section>

            <Separator />

            <Section
              title="Triggers"
              status={stages.triggers?.status || "incomplete"}
              isEditing={editingSection === "triggers"}
              onStartEdit={() => startEdit("triggers")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              editContent={
                <TriggersSection
                  config={config.triggers || {}}
                  triggers={getTriggers(config)}
                  draft={draft}
                  editing={true}
                  onDraftChange={setDraft}
                />
              }
            >
              <TriggersSection
                config={config.triggers || {}}
                triggers={getTriggers(config)}
                draft={draft}
                editing={false}
                onDraftChange={setDraft}
              />
            </Section>

            <Separator />

            <Section
              title="Guardrails"
              status={stages.guardrails?.status || "incomplete"}
              isEditing={editingSection === "guardrails"}
              onStartEdit={() => startEdit("guardrails")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              editContent={
                <GuardrailsSection
                  config={config.guardrails || {}}
                  draft={draft}
                  editing={true}
                  onDraftChange={setDraft}
                />
              }
            >
              <GuardrailsSection
                config={config.guardrails || {}}
                draft={draft}
                editing={false}
                onDraftChange={setDraft}
              />
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
