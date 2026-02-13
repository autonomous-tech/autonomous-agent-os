"use client";

import { Plus, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
  emoji?: string;
  lettaAgentId?: string | null;
}

interface NavRailProps {
  agents: Agent[];
}

export function NavRail({ agents }: NavRailProps) {
  const router = useRouter();
  const { activeAgentId, setActiveAgent } = useWorkspaceStore();

  const handleAgentClick = (agent: Agent) => {
    setActiveAgent(agent.id, agent.lettaAgentId || null);
  };

  const handleNewAgent = () => {
    router.push("/agents/new");
  };

  const handleSettings = () => {
    router.push("/settings");
  };

  return (
    <div className="flex w-12 flex-col items-center border-r border-zinc-800 bg-zinc-900 py-4">
      {/* Logo */}
      <TooltipProvider>
        <div className="mb-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-lg font-bold">
            A
          </div>
        </div>

        {/* Agent List */}
        <div className="flex-1 space-y-2 overflow-y-auto">
          {agents.map((agent) => (
            <Tooltip key={agent.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleAgentClick(agent)}
                  className={cn(
                    "h-10 w-10 rounded-lg transition-colors",
                    activeAgentId === agent.id
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  )}
                >
                  <span className="text-xl">{agent.emoji || "🤖"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-800 text-zinc-100">
                {agent.name}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="space-y-2 border-t border-zinc-800 pt-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleNewAgent}
                className="h-10 w-10 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-zinc-800 text-zinc-100">
              Create Agent
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleSettings}
                className="h-10 w-10 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-zinc-800 text-zinc-100">
              Settings
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
