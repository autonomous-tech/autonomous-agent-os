"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/builder/Sidebar";
import { ChatPane } from "@/components/builder/ChatPane";
import { PreviewPane } from "@/components/builder/PreviewPane";
import { ArrowLeft, Save, Download, Loader2 } from "lucide-react";
import type {
  StageName,
  AgentConfig,
  StageData,
  ConversationData,
  ChatMessage,
  StageStatus,
} from "@/lib/types";
import { defaultStageData, defaultConversations } from "@/lib/types";

interface AgentData {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  config: AgentConfig;
  stages: StageData;
  conversations: ConversationData;
}

export default function BuilderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [agent, setAgent] = useState<AgentData | null>(null);
  const [currentStage, setCurrentStage] = useState<StageName>("mission");
  const [config, setConfig] = useState<AgentConfig>({});
  const [stages, setStages] = useState<StageData>(defaultStageData());
  const [conversations, setConversations] = useState<ConversationData>(defaultConversations());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Fetch agent data on mount
  useEffect(() => {
    async function fetchAgent() {
      try {
        const res = await fetch(`/api/agents/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            router.push("/");
            return;
          }
          throw new Error("Failed to fetch agent");
        }
        const data = await res.json();
        setAgent(data);
        setConfig(data.config || {});
        setStages(data.stages || defaultStageData());
        setConversations(data.conversations || defaultConversations());

        // Set initial stage based on first incomplete stage
        const stageOrder: StageName[] = [
          "mission",
          "identity",
          "capabilities",
          "memory",
          "triggers",
          "guardrails",
        ];
        const firstIncomplete = stageOrder.find(
          (s) => !data.stages?.[s] || data.stages[s].status === "incomplete"
        );
        if (firstIncomplete) {
          setCurrentStage(firstIncomplete);
        }
      } catch (error) {
        console.error("Failed to fetch agent:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAgent();
  }, [id, router]);

  // Save to server
  const save = useCallback(async () => {
    if (!agent) return;
    setIsSaving(true);
    try {
      await fetch(`/api/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config,
          stages,
          conversations,
          name: config.identity?.name || agent.name,
        }),
      });
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  }, [id, agent, config, stages, conversations]);

  // Handle messages update for current stage
  const handleMessagesUpdate = useCallback(
    (messages: ChatMessage[]) => {
      setConversations((prev) => ({
        ...prev,
        [currentStage]: messages,
      }));
    },
    [currentStage]
  );

  // Handle config updates from chat
  const handleConfigUpdate = useCallback(
    (updates: Array<{ field: string; value: unknown }>, stage: StageName) => {
      setConfig((prev) => {
        const stageConfig = (prev[stage as keyof AgentConfig] || {}) as Record<
          string,
          unknown
        >;
        const updated = { ...stageConfig };
        for (const u of updates) {
          updated[u.field] = u.value;
        }
        return {
          ...prev,
          [stage]: updated,
        };
      });
    },
    []
  );

  // Handle direct config edits from preview pane
  const handleDirectConfigUpdate = useCallback(
    (stage: StageName, data: Record<string, unknown>) => {
      setConfig((prev) => ({
        ...prev,
        [stage]: data,
      }));
      // Mark stage as draft if it was incomplete
      setStages((prev) => ({
        ...prev,
        [stage]: {
          ...prev[stage],
          status: prev[stage]?.status === "incomplete" ? "draft" : prev[stage]?.status,
        },
      }));
    },
    []
  );

  // Handle stage status update
  const handleStageStatusUpdate = useCallback(
    (stage: StageName, status: StageStatus) => {
      setStages((prev) => ({
        ...prev,
        [stage]: { ...prev[stage], status },
      }));
    },
    []
  );

  // Handle export
  const handleExport = useCallback(async () => {
    if (!agent) return;
    setIsExporting(true);
    setExportError(null);

    // Save first
    await save();

    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });

      if (res.status === 400) {
        const data = await res.json();
        const errorMessages = data.errors
          ?.map((e: { message: string; fix?: string }) => `${e.message}${e.fix ? ` (${e.fix})` : ""}`)
          .join("\n");
        setExportError(errorMessages || "Validation failed");
        setIsExporting(false);
        return;
      }

      if (!res.ok) throw new Error("Export failed");

      // Download the ZIP
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${agent.slug}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      setExportError("Failed to export. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [agent, id, save]);

  // Stage statu map for sidebar
  const stageStatuses = Object.fromEntries(
    Object.entries(stages).map(([key, val]) => [key, val.status])
  ) as Record<StageName, StageStatus>;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Agent not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-semibold">Agent OS</span>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium">
            {config.identity?.name || agent.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {exportError && (
            <span className="text-xs text-destructive mr-2 max-w-md truncate">
              {exportError}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={save} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            Save
          </Button>
          <Button size="sm" onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Download className="h-3.5 w-3.5 mr-1.5" />
            )}
            Export
          </Button>
        </div>
      </header>

      {/* Main content: Sidebar + Chat + Preview */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentStage={currentStage}
          stageStatuses={stageStatuses}
          onStageSelect={setCurrentStage}
        />

        {/* Chat pane (40%) */}
        <div className="flex w-2/5 flex-col border-r">
          <div className="flex h-10 items-center border-b px-4">
            <h3 className="text-sm font-semibold capitalize">
              {currentStage}
            </h3>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatPane
              projectId={id}
              stage={currentStage}
              messages={conversations[currentStage] || []}
              onMessagesUpdate={handleMessagesUpdate}
              onConfigUpdate={handleConfigUpdate}
              onStageStatusUpdate={handleStageStatusUpdate}
            />
          </div>
        </div>

        {/* Preview pane (60%) */}
        <div className="flex flex-1 flex-col">
          <div className="flex h-10 items-center border-b px-4">
            <h3 className="text-sm font-semibold">Agent Preview</h3>
          </div>
          <div className="flex-1 overflow-hidden">
            <PreviewPane
              projectId={id}
              config={config}
              stages={stages}
              onExport={handleExport}
              isExporting={isExporting}
              onStageSelect={setCurrentStage}
              onConfigUpdate={handleDirectConfigUpdate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
