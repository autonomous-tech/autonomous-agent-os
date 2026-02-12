"use client";

import { useState, useEffect } from "react";
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
  Rocket,
  Pause,
  ExternalLink,
  RefreshCw,
  Wrench,
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
  deployment?: { id: string; status: string; version: number; createdAt: string } | null;
  agentSlug?: string;
  onDeploy?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  isDeploying?: boolean;
}

export function PreviewPane({
  projectId,
  config,
  stages,
  onExport,
  isExporting,
  onStageSelect,
  onConfigUpdate,
  deployment,
  agentSlug,
  onDeploy,
  onPause,
  onResume,
  isDeploying,
}: PreviewPaneProps) {
  const [showTestChat, setShowTestChat] = useState(false);
  const [editingSection, setEditingSection] = useState<StageName | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [mcpServers, setMcpServers] = useState<Array<{id: string; name: string; transport: string; status: string}>>([]);

  useEffect(() => {
    async function fetchMcpServers() {
      try {
        const res = await fetch(`/api/agents/${projectId}/mcp-servers`);
        if (res.ok) {
          const data = await res.json();
          setMcpServers(data.servers || []);
        }
      } catch {
        // Silently ignore — MCP servers are optional
      }
    }
    fetchMcpServers();
  }, [projectId]);

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

            {/* MCP Servers - only show if any are configured */}
            {mcpServers.length > 0 && (
              <>
                <Separator />
                <div className="rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                      Executable Tools
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {mcpServers.length} server{mcpServers.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {mcpServers.map((server) => (
                      <div key={server.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={cn("h-1.5 w-1.5 rounded-full", server.status === "active" ? "bg-green-500" : "bg-muted-foreground/30")} />
                        <span>{server.name}</span>
                        <span className="text-muted-foreground/50">({server.transport})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

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
      <div className="border-t p-4 flex flex-col gap-2">
        {deployment?.status === "active" && agentSlug && (
          <div className="flex items-center justify-between px-1 pb-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs text-green-500 font-medium">Live — v{deployment.version}</span>
            </div>
            <a
              href={`/a/${agentSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              /a/{agentSlug} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        {deployment?.status === "paused" && (
          <div className="flex items-center gap-2 px-1 pb-1">
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
            <span className="text-xs text-yellow-500 font-medium">Paused — v{deployment.version}</span>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setShowTestChat(true)}
            disabled={!hasAnyStageCompleted}
          >
            <Play className="h-4 w-4 mr-2" />
            Try It
          </Button>
          {!deployment || deployment.status === "retired" ? (
            <Button
              variant="outline"
              className="flex-1"
              onClick={onDeploy}
              disabled={isDeploying || !hasAnyStageCompleted}
            >
              {isDeploying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4 mr-2" />
              )}
              Deploy
            </Button>
          ) : deployment.status === "active" ? (
            <>
              <Button variant="outline" className="flex-1" onClick={onPause}>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={onDeploy}
                disabled={isDeploying}
              >
                {isDeploying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Redeploy
              </Button>
            </>
          ) : deployment.status === "paused" ? (
            <Button variant="outline" className="flex-1" onClick={onResume}>
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
          ) : null}
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
    </div>
  );
}
