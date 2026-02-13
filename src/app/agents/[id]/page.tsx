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
  Loader2,
  MessageSquare,
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

  // Builder state
  const [currentStage, setCurrentStage] = useState<StageName>("mission");
  const [config, setConfig] = useState<AgentConfig>({});
  const [stages, setStages] = useState<StageData>(defaultStageData());
  const [conversations, setConversations] = useState<ConversationData>(defaultConversations());
  const [isSaving, setIsSaving] = useState(false);
  const [deployment, setDeployment] = useState<{
    id: string;
    status: string;
    version: number;
    createdAt: string;
    lettaAgentId?: string;
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
        setAgent((prev) => prev ? { ...prev, status: "deployed", ...(data.lettaAgentId ? { lettaAgentId: data.lettaAgentId } : {}) } : null);
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
          {agent.status === "deployed" && (
            <Link
              href={`/agents/${id}/workspace`}
              className="ml-2 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Workspace
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={save} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            Save
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
