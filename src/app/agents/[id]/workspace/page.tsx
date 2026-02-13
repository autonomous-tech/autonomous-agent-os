"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  Brain,
  Wrench,
  FileText,
  Settings,
  Pencil,
} from "lucide-react";
import type { AgentConfig } from "@/lib/types";

// Lazy imports for workspace components
import dynamic from "next/dynamic";
const ChatPanel = dynamic(
  () =>
    import("@/components/workspace/chat/ChatPanel").then((m) => ({
      default: m.ChatPanel,
    })),
  { loading: () => <WorkspaceTabLoading /> }
);
const MemoryPanel = dynamic(
  () =>
    import("@/components/workspace/memory/MemoryPanel").then((m) => ({
      default: m.MemoryPanel,
    })),
  { loading: () => <WorkspaceTabLoading /> }
);
const ToolLogPanel = dynamic(
  () =>
    import("@/components/workspace/tools/ToolLogPanel").then((m) => ({
      default: m.ToolLogPanel,
    })),
  { loading: () => <WorkspaceTabLoading /> }
);

function WorkspaceTabLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
    </div>
  );
}

type WorkspaceTab = "chat" | "memory" | "tools" | "artifacts" | "settings";

const WORKSPACE_TABS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: typeof MessageSquare;
}> = [
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
  lettaAgentId?: string | null;
}

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [agent, setAgent] = useState<AgentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Workspace tab state
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("chat");

  // Deploy lifecycle state
  const [deployment, setDeployment] = useState<{
    id: string;
    status: string;
    version: number;
    createdAt: string;
    lettaAgentId?: string;
  } | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);

  // Fetch agent data and deployment status on mount
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

        // If agent is not deployed, redirect to the builder
        if (data.status !== "deployed") {
          router.push(`/agents/${id}`);
          return;
        }

        setAgent(data);

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
      } catch (error) {
        console.error("Failed to fetch agent:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAgent();
  }, [id, router]);

  // Keyboard shortcuts: Cmd+1..5 for tabs
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
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
  }, []);

  // Deploy handler (for memory deploy button)
  const handleDeploy = useCallback(async () => {
    if (!agent) return;
    setIsDeploying(true);
    try {
      const res = await fetch(`/api/agents/${id}/deploy`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setDeployment(data.deployment);
        setAgent((prev) =>
          prev
            ? {
                ...prev,
                status: "deployed",
                ...(data.lettaAgentId
                  ? { lettaAgentId: data.lettaAgentId }
                  : {}),
              }
            : null
        );
      }
    } catch (error) {
      console.error("Deploy error:", error);
    } finally {
      setIsDeploying(false);
    }
  }, [agent, id]);

  const handlePause = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${id}/deploy`, { method: "DELETE" });
      if (res.ok) {
        setDeployment((prev) =>
          prev ? { ...prev, status: "paused" } : null
        );
      }
    } catch (error) {
      console.error("Pause error:", error);
    }
  }, [id]);

  const handleResume = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${id}/deploy`, { method: "PATCH" });
      if (res.ok) {
        setDeployment((prev) =>
          prev ? { ...prev, status: "active" } : null
        );
      }
    } catch (error) {
      console.error("Resume error:", error);
    }
  }, [id]);

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
            {agent.config.identity?.emoji && (
              <span className="mr-1.5">{agent.config.identity.emoji}</span>
            )}
            {agent.config.identity?.name || agent.name}
          </span>
          {agent.lettaAgentId && (
            <span className="text-[10px] text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded">
              <Brain className="h-2.5 w-2.5 inline mr-0.5" />
              Memory Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/agents/${id}`}>
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-zinc-200"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Configure
            </Button>
          </Link>
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
          <ChatPanel agentId={agent.id} slug={agent.slug} />
        )}
        {activeTab === "memory" && agent.lettaAgentId && (
          <MemoryPanel lettaAgentId={agent.lettaAgentId} />
        )}
        {activeTab === "memory" && !agent.lettaAgentId && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Brain className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-400 mb-2">
                Memory requires Letta deployment
              </p>
              <Button size="sm" onClick={handleDeploy} disabled={isDeploying}>
                {isDeploying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : null}
                Deploy with Memory
              </Button>
            </div>
          </div>
        )}
        {activeTab === "tools" && <ToolLogPanel agentId={agent.id} />}
        {activeTab === "artifacts" && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <FileText className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-400">
                Artifacts will appear here as your agent produces work
              </p>
            </div>
          </div>
        )}
        {activeTab === "settings" && (
          <div className="p-6 max-w-2xl">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">
              Agent Settings
            </h2>
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-800 p-4">
                <h3 className="text-sm font-medium text-zinc-200 mb-1">
                  Status
                </h3>
                <p className="text-sm text-zinc-400">{agent.status}</p>
              </div>
              {agent.lettaAgentId && (
                <div className="rounded-lg border border-zinc-800 p-4">
                  <h3 className="text-sm font-medium text-zinc-200 mb-1">
                    Letta Agent ID
                  </h3>
                  <p className="text-sm text-zinc-500 font-mono">
                    {agent.lettaAgentId}
                  </p>
                </div>
              )}
              <div className="rounded-lg border border-zinc-800 p-4">
                <h3 className="text-sm font-medium text-zinc-200 mb-1">
                  Public URL
                </h3>
                <p className="text-sm text-zinc-400">/a/{agent.slug}</p>
              </div>
              <div className="flex gap-2 pt-2">
                {deployment?.status === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-yellow-500 border-yellow-500/30"
                    onClick={handlePause}
                  >
                    Pause
                  </Button>
                )}
                {deployment?.status === "paused" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-green-500 border-green-500/30"
                    onClick={handleResume}
                  >
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
