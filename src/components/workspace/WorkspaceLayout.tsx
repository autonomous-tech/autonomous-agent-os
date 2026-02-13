"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NavRail } from "./NavRail";
import { ChatPanel } from "./chat/ChatPanel";
import { MemoryPanel } from "./memory/MemoryPanel";
import { ToolLogPanel } from "./tools/ToolLogPanel";
import { MessageSquare, Database, Wrench, FileText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceLayoutProps {
  agents: Array<{ id: string; name: string; emoji?: string; lettaAgentId?: string | null }>;
}

export function WorkspaceLayout({ agents }: WorkspaceLayoutProps) {
  const {
    activeAgentId,
    activeLettaAgentId,
    activeTab,
    rightPanelOpen,
    sidebarCollapsed,
    setActiveTab,
    toggleSidebar,
  } = useWorkspaceStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (!modKey) return;

      switch (e.key) {
        case "1":
          e.preventDefault();
          setActiveTab("chat");
          break;
        case "2":
          e.preventDefault();
          setActiveTab("memory");
          break;
        case "3":
          e.preventDefault();
          setActiveTab("tools");
          break;
        case "4":
          e.preventDefault();
          setActiveTab("artifacts");
          break;
        case "5":
          e.preventDefault();
          setActiveTab("settings");
          break;
        case "b":
          e.preventDefault();
          toggleSidebar();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveTab, toggleSidebar]);

  const activeAgent = agents.find((a) => a.id === activeAgentId);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Left: Nav Rail */}
      <NavRail agents={agents} />

      {/* Center: Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Tab Bar */}
        <div className="border-b border-zinc-800 bg-zinc-900">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="h-12 w-full justify-start rounded-none border-0 bg-transparent p-0">
              <TabsTrigger
                value="chat"
                className="relative h-12 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-zinc-100 data-[state=active]:bg-zinc-800/50"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger
                value="memory"
                className="relative h-12 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-zinc-100 data-[state=active]:bg-zinc-800/50"
              >
                <Database className="mr-2 h-4 w-4" />
                Memory
              </TabsTrigger>
              <TabsTrigger
                value="tools"
                className="relative h-12 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-zinc-100 data-[state=active]:bg-zinc-800/50"
              >
                <Wrench className="mr-2 h-4 w-4" />
                Tools
              </TabsTrigger>
              <TabsTrigger
                value="artifacts"
                className="relative h-12 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-zinc-100 data-[state=active]:bg-zinc-800/50"
              >
                <FileText className="mr-2 h-4 w-4" />
                Artifacts
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="relative h-12 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-zinc-100 data-[state=active]:bg-zinc-800/50"
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "chat" && activeAgent && (
            <ChatPanel agentId={activeAgent.id} lettaAgentId={activeAgent.lettaAgentId || null} />
          )}
          {activeTab === "memory" && activeLettaAgentId && (
            <MemoryPanel lettaAgentId={activeLettaAgentId} />
          )}
          {activeTab === "tools" && activeAgent && <ToolLogPanel agentId={activeAgent.id} />}
          {activeTab === "artifacts" && (
            <div className="flex h-full items-center justify-center text-zinc-500">
              <div className="text-center">
                <FileText className="mx-auto mb-2 h-12 w-12" />
                <p>Artifacts panel coming soon</p>
              </div>
            </div>
          )}
          {activeTab === "settings" && (
            <div className="flex h-full items-center justify-center text-zinc-500">
              <div className="text-center">
                <Settings className="mx-auto mb-2 h-12 w-12" />
                <p>Settings panel coming soon</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Collapsible Context Panel */}
      {rightPanelOpen && (
        <div className="w-[300px] border-l border-zinc-800 bg-zinc-900">
          <div className="p-4">
            <h3 className="text-sm font-medium text-zinc-400">Context Panel</h3>
            {/* Context panel content will go here */}
          </div>
        </div>
      )}
    </div>
  );
}
