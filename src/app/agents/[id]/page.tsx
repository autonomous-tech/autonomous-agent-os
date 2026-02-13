"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/builder/Sidebar";
import { ChatPane } from "@/components/builder/ChatPane";
import { PreviewPane } from "@/components/builder/PreviewPane";
import {
  ArrowLeft,
  Save,
  Download,
  Loader2,
  MessageSquare,
  Brain,
  Wrench,
  FileText,
  Settings,
  Pencil,
} from "lucide-react";
import type {
  StageName,
  AgentConfig,
  StageData,
  ConversationData,
  ChatMessage,
  StageStatus,
} from "@/lib/types";
import { STAGES, defaultStageData, defaultConversations } from "@/lib/types";

// Lazy imports for workspace components (only loaded when agent has Letta)
import dynamic from "next/dynamic";
const ChatPanel = dynamic(() => import("@/components/workspace/chat/ChatPanel").then(m => ({ default: m.ChatPanel })), {
  loading: () => <WorkspaceTabLoading />,
});
const MemoryPanel = dynamic(() => import("@/components/workspace/memory/MemoryPanel").then(m => ({ default: m.MemoryPanel })), {
  loading: () => <WorkspaceTabLoading />,
});
const ToolLogPanel = dynamic(() => import("@/components/workspace/tools/ToolLogPanel").then(m => ({ default: m.ToolLogPanel })), {
  loading: () => <WorkspaceTabLoading />,
});

function WorkspaceTabLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
    </div>
  );
}

type WorkspaceTab = "chat" | "memory" | "tools" | "artifacts" | "settings";

const WORKSPACE_TABS: Array<{ id: WorkspaceTab; label: string; icon: typeof MessageSquare }> = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "artifacts", label: "Artifacts", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
];

interface AgentData {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  config: AgentConfig;
  stages: StageData;
  conversations: ConversationData;
  lettaAgentId?: string | null;
}

export default function AgentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [agent, setAgent] = useState<AgentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Workspace state (for Letta agents)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("chat");
  const [mode, setMode] = useState<"workspace" | "builder">("workspace");

  // Builder state (existing)
  const [currentStage, setCurrentStage] = useState<StageName>("mission");
  const [config, setConfig] = useState<AgentConfig>({});
  const [stages, setStages] = useState<StageData>(defaultStageData());
  const [conversations, setConversations] = useState<ConversationData>(defaultConversations());
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deployment, setDeployment] = useState<{
    id: string;
    status: string;
    version: number;
    createdAt: string;
    lettaAgentId?: string;
    runtime?: string;
  } | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showDeploySuccess, setShowDeploySuccess] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string>("");
  const [deployError, setDeployError] = useState<string | null>(null);

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

        // If agent has Letta, start in workspace mode
        if (data.lettaAgentId) {
          setMode("workspace");
        } else {
          setMode("builder");
        }

        // Fetch deployment status
        try {
          const deployRes = await fetch(`/api/agents/${id}/deploy`);
          if (deployRes.ok) {
            const deployData = await deployRes.json();
            setDeployment(deployData.deployment);
          }
        } catch {
          // Deployment fetch is non-critical
        }

        // Set initial builder stage
        const firstIncomplete = STAGES.find(
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

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (mode !== "workspace") return;
      if (e.metaKey || e.ctrlKey) {
        const tabIndex = parseInt(e.key) - 1;
        if (tabIndex >= 0 && tabIndex < WORKSPACE_TABS.length) {
          e.preventDefault();
          setActiveTab(WORKSPACE_TABS[tabIndex].id);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode]);

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

  const handleMessagesUpdate = useCallback(
    (messages: ChatMessage[]) => {
      setConversations((prev) => ({
        ...prev,
        [currentStage]: messages,
      }));
    },
    [currentStage]
  );

  const handleConfigUpdate = useCallback(
    (updates: Array<{ field: string; value: unknown }>, stage: StageName) => {
      setConfig((prev) => {
        const stageConfig = (prev[stage as keyof AgentConfig] || {}) as Record<string, unknown>;
        const updated = { ...stageConfig };
        for (const u of updates) {
          updated[u.field] = u.value;
        }
        return { ...prev, [stage]: updated };
      });
    },
    []
  );

  const handleDirectConfigUpdate = useCallback(
    (stage: StageName, data: Record<string, unknown>) => {
      setConfig((prev) => ({ ...prev, [stage]: data }));
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

  const handleStageStatusUpdate = useCallback(
    (stage: StageName, status: StageStatus) => {
      setStages((prev) => ({ ...prev, [stage]: { ...prev[stage], status } }));
    },
    []
  );

  const handleDeploy = useCallback(async () => {
    if (!agent) return;
    setIsDeploying(true);
    setDeployError(null);
    await save();
    try {
      const res = await fetch(`/api/agents/${id}/deploy`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setDeployment(data.deployment);
        const publicUrl = data.publicUrl || (agent.slug ? `${window.location.origin}/a/${agent.slug}` : "");
        setDeployedUrl(publicUrl);
        setShowDeploySuccess(true);
        // If deployed to Letta, update agent data and switch to workspace
        if (data.deployment?.lettaAgentId) {
          setAgent((prev) => prev ? { ...prev, lettaAgentId: data.deployment.lettaAgentId, status: "deployed" } : null);
          setMode("workspace");
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setDeployError(data.error || "Deploy failed. Please try again.");
      }
    } catch (error) {
      console.error("Deploy error:", error);
      setDeployError("Deploy failed. Please try again.");
    } finally {
      setIsDeploying(false);
    }
  }, [agent, id, save]);

  const handlePause = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${id}/deploy`, { method: "DELETE" });
      if (res.ok) {
        setDeployment((prev) => (prev ? { ...prev, status: "paused" } : null));
      }
    } catch (error) {
      console.error("Pause error:", error);
    }
  }, [id]);

  const handleResume = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${id}/deploy`, { method: "PATCH" });
      if (res.ok) {
        setDeployment((prev) => (prev ? { ...prev, status: "active" } : null));
      }
    } catch (error) {
      console.error("Resume error:", error);
    }
  }, [id]);

  const handleExport = useCallback(async () => {
    if (!agent) return;
    setIsExporting(true);
    setExportError(null);
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

  const stageStatuses = Object.fromEntries(
    Object.entries(stages).map(([key, val]) => [key, val.status])
  ) as Record<StageName, StageStatus>;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <p className="text-zinc-400">Agent not found.</p>
      </div>
    );
  }

  // ── Workspace Mode (Letta-deployed agents) ──────────────────────
  if (mode === "workspace") {
    return (
      <div className="flex h-screen flex-col bg-zinc-950">
        {/* Workspace Header */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-sm font-semibold text-zinc-100">
              {config.identity?.emoji && <span className="mr-1.5">{config.identity.emoji}</span>}
              {config.identity?.name || agent.name}
            </span>
            {deployment?.runtime === "letta" && (
              <span className="text-[10px] text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded">
                <Brain className="h-2.5 w-2.5 inline mr-0.5" />
                Memory Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-zinc-200"
              onClick={() => setMode("builder")}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Configure
            </Button>
          </div>
        </header>

        {/* Workspace Tab Bar */}
        <div className="flex h-10 shrink-0 items-center border-b border-zinc-800 px-4 gap-1">
          {WORKSPACE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Workspace Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "chat" && (
            <ChatPanel agentId={agent.id} lettaAgentId={agent.lettaAgentId ?? null} />
          )}
          {activeTab === "memory" && agent.lettaAgentId && (
            <MemoryPanel lettaAgentId={agent.lettaAgentId} />
          )}
          {activeTab === "memory" && !agent.lettaAgentId && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Brain className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-400 mb-2">Memory requires Letta deployment</p>
                <Button size="sm" onClick={handleDeploy} disabled={isDeploying}>
                  {isDeploying ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Deploy with Memory
                </Button>
              </div>
            </div>
          )}
          {activeTab === "tools" && (
            <ToolLogPanel agentId={agent.id} />
          )}
          {activeTab === "artifacts" && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <FileText className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-400">Artifacts will appear here as your agent produces work</p>
              </div>
            </div>
          )}
          {activeTab === "settings" && (
            <div className="p-6 max-w-2xl">
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">Agent Settings</h2>
              <div className="space-y-4">
                <div className="rounded-lg border border-zinc-800 p-4">
                  <h3 className="text-sm font-medium text-zinc-200 mb-1">Status</h3>
                  <p className="text-sm text-zinc-400">{agent.status}</p>
                </div>
                <div className="rounded-lg border border-zinc-800 p-4">
                  <h3 className="text-sm font-medium text-zinc-200 mb-1">Runtime</h3>
                  <p className="text-sm text-zinc-400">{deployment?.runtime === "letta" ? "Letta (persistent memory)" : "Claude (stateless)"}</p>
                </div>
                {agent.lettaAgentId && (
                  <div className="rounded-lg border border-zinc-800 p-4">
                    <h3 className="text-sm font-medium text-zinc-200 mb-1">Letta Agent ID</h3>
                    <p className="text-sm text-zinc-500 font-mono">{agent.lettaAgentId}</p>
                  </div>
                )}
                <div className="rounded-lg border border-zinc-800 p-4">
                  <h3 className="text-sm font-medium text-zinc-200 mb-1">Public URL</h3>
                  <p className="text-sm text-zinc-400">/a/{agent.slug}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
                    {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                    Export ZIP
                  </Button>
                  {deployment?.status === "active" && (
                    <Button variant="outline" size="sm" className="text-yellow-500 border-yellow-500/30" onClick={handlePause}>
                      Pause
                    </Button>
                  )}
                  {deployment?.status === "paused" && (
                    <Button variant="outline" size="sm" className="text-green-500 border-green-500/30" onClick={handleResume}>
                      Resume
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Builder Mode (original 6-stage builder) ─────────────────────
  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Agents</span>
          </Link>
          <span className="text-sm font-semibold text-zinc-100">Agent OS</span>
          <span className="text-sm text-zinc-500">/</span>
          <span className="text-sm font-medium text-zinc-200">
            {config.identity?.name || agent.name}
          </span>
          {agent.lettaAgentId && (
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-zinc-200 ml-2"
              onClick={() => setMode("workspace")}
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Workspace
            </Button>
          )}
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
        <Sidebar
          currentStage={currentStage}
          stageStatuses={stageStatuses}
          onStageSelect={setCurrentStage}
        />
        <div className="flex w-2/5 flex-col border-r border-zinc-800">
          <div className="flex h-10 items-center border-b border-zinc-800 px-4">
            <h3 className="text-sm font-semibold capitalize text-zinc-200">
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
        <div className="flex flex-1 flex-col">
          <div className="flex h-10 items-center border-b border-zinc-800 px-4">
            <h3 className="text-sm font-semibold text-zinc-200">Agent Preview</h3>
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
              deployment={deployment}
              agentSlug={agent.slug}
              onDeploy={handleDeploy}
              onPause={handlePause}
              onResume={handleResume}
              isDeploying={isDeploying}
              showDeploySuccess={showDeploySuccess}
              onDeploySuccessDismiss={() => setShowDeploySuccess(false)}
              deployedUrl={deployedUrl}
              deployError={deployError}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
