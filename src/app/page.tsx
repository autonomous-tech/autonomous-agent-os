import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Bot, Zap, Brain, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline"; color?: string }> = {
  draft: { label: "Draft", variant: "outline" },
  building: { label: "Building", variant: "secondary" },
  exported: { label: "Exported", variant: "default" },
  deployed: { label: "Live", variant: "default", color: "text-green-500" },
};

export default async function Home() {
  const agents = await prisma.agentProject.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      deployments: {
        where: { status: "active" },
        take: 1,
      },
    },
  });

  const stats = {
    total: agents.length,
    deployed: agents.filter((a) => a.status === "deployed").length,
    withLetta: agents.filter((a) => a.lettaAgentId).length,
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
              <Bot className="h-4 w-4 text-zinc-300" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-100">Agent OS</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/agents/new">
              <Button size="sm" className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200">
                <Plus className="h-4 w-4 mr-1.5" />
                New Agent
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Stats bar */}
      {agents.length > 0 && (
        <div className="border-b border-zinc-800/50">
          <div className="mx-auto flex max-w-6xl gap-8 px-6 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Bot className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-zinc-400">{stats.total} agents</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-3.5 w-3.5 text-green-500" />
              <span className="text-zinc-400">{stats.deployed} deployed</span>
            </div>
            {stats.withLetta > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Brain className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-zinc-400">{stats.withLetta} with memory</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800">
              <Bot className="h-8 w-8 text-zinc-500" />
            </div>
            <p className="text-zinc-400 text-center max-w-md">
              Create your first agent to get started. Agents can be deployed with persistent memory through Letta, or as lightweight Claude-powered chatbots.
            </p>
            <Link href="/agents/new">
              <Button className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200">
                <Plus className="h-4 w-4 mr-1.5" />
                New Agent
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => {
              const config = JSON.parse(agent.config || "{}");
              const identity = config.identity || {};
              const mission = config.mission || {};
              const status = statusConfig[agent.status] || statusConfig.draft;
              const hasLetta = !!agent.lettaAgentId;
              const isDeployed = agent.status === "deployed";
              const activeDeployment = agent.deployments?.[0];

              return (
                <Link key={agent.id} href={`/agents/${agent.id}`}>
                  <Card className="group cursor-pointer bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          {identity.emoji && (
                            <span className="text-xl">{identity.emoji}</span>
                          )}
                          <CardTitle className="text-sm font-semibold text-zinc-100">
                            {agent.name}
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {hasLetta && (
                            <Badge variant="outline" className="text-purple-400 border-purple-400/30 text-[10px] px-1.5">
                              <Brain className="h-2.5 w-2.5 mr-0.5" />
                              Memory
                            </Badge>
                          )}
                          <Badge
                            variant={status.variant}
                            className={isDeployed ? "bg-green-500/10 text-green-500 border-green-500/20" : ""}
                          >
                            {status.label}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {mission.description && (
                        <p className="text-xs text-zinc-400 line-clamp-2 mb-3">
                          {mission.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500">
                          {new Date(agent.updatedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                          {activeDeployment && ` · v${activeDeployment.version}`}
                        </span>
                        {isDeployed && agent.slug && (
                          <span className="text-[11px] text-green-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink className="h-2.5 w-2.5" />
                            Live
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}

            {/* Quick-create card */}
            <Link href="/agents/new">
              <Card className="cursor-pointer border-dashed border-zinc-800 hover:border-zinc-600 bg-transparent transition-all h-full flex items-center justify-center min-h-[140px]">
                <CardContent className="flex flex-col items-center gap-2 py-6">
                  <Plus className="h-6 w-6 text-zinc-600" />
                  <span className="text-sm text-zinc-500">New Agent</span>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
