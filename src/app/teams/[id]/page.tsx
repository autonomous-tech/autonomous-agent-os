"use client";

import { use, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Plus, Loader2, Rocket, FolderKanban, Activity } from "lucide-react";

const ChatPanel = dynamic(
  () => import("@/components/workspace/chat/ChatPanel").then((m) => ({ default: m.ChatPanel })),
  { ssr: false }
);

interface AgentWithConfig {
  id: string;
  name: string;
  lettaAgentId: string | null;
  config: Record<string, unknown>;
}

interface TeamMember {
  id: string;
  agentId: string;
  agentName: string;
  agentSlug: string;
  agentDescription: string;
  agentStatus: string;
  role: string;
  lettaAgentId: string | null;
  createdAt: string;
}

interface TeamProject {
  id: string;
  name: string;
  brief: string;
  status: string;
  lettaBlockIds: Record<string, unknown>;
  activityLog: ActivityEntry[];
  createdAt: string;
  updatedAt: string;
}

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  members: TeamMember[];
  projects: TeamProject[];
  createdAt: string;
  updatedAt: string;
}

interface MemoryBlock {
  label: string;
  value: string;
}

interface ActivityEntry {
  timestamp: string;
  type: string;
  message: string;
}

export default function TeamWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [team, setTeam] = useState<Team | null>(null);
  const [agents, setAgents] = useState<Map<string, AgentWithConfig>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  const [memoryBlocks, setMemoryBlocks] = useState<MemoryBlock[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectBrief, setProjectBrief] = useState("");
  const [showProjectForm, setShowProjectForm] = useState(false);

  useEffect(() => {
    loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (team && team.members.length > 0) {
      loadMemory();
      loadActivity();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, activeAgentIndex]);

  const loadTeam = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/teams/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch team: ${response.status}`);
      }

      const data = await response.json();
      setTeam(data);

      // Fetch agent configs for all members
      const agentMap = new Map<string, AgentWithConfig>();
      await Promise.all(
        data.members.map(async (member: TeamMember) => {
          try {
            const agentRes = await fetch(`/api/agents/${member.agentId}`);
            if (agentRes.ok) {
              const agentData = await agentRes.json();
              agentMap.set(member.agentId, {
                id: agentData.id,
                name: agentData.name,
                lettaAgentId: agentData.lettaAgentId,
                config: agentData.config,
              });
            }
          } catch (err) {
            console.error(`Failed to load agent ${member.agentId}:`, err);
          }
        })
      );
      setAgents(agentMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMemory = async () => {
    if (!team || team.members.length === 0) return;

    const activeMember = team.members[activeAgentIndex];
    if (!activeMember.lettaAgentId) {
      setMemoryBlocks([]);
      return;
    }

    try {
      const response = await fetch(`/api/letta/agents/${activeMember.lettaAgentId}/memory`);
      if (!response.ok) {
        console.error("Failed to fetch memory");
        return;
      }

      const data = await response.json();

      // Filter for shared memory blocks
      const sharedBlocks = data.memory?.blocks?.filter((block: MemoryBlock) =>
        ["project", "decisions", "task_board", "brand"].includes(block.label)
      ) || [];

      setMemoryBlocks(sharedBlocks);
    } catch (err) {
      console.error("Failed to load memory:", err);
    }
  };

  const loadActivity = async () => {
    if (!team || team.projects.length === 0) return;

    try {
      // Parse activity log from the first project
      const project = team.projects[0];
      const activityData = project.activityLog || [];
      const activities = Array.isArray(activityData) ? activityData : [];

      setActivityLog(activities.slice(-10).reverse()); // Show last 10 activities, most recent first
    } catch (err) {
      console.error("Failed to load activity:", err);
      setActivityLog([]);
    }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }

    setIsCreatingProject(true);
    setError("");

    try {
      const response = await fetch(`/api/teams/${id}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          brief: projectBrief.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create project");
      }

      await loadTeam();
      setProjectName("");
      setProjectBrief("");
      setShowProjectForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleDeploy = async () => {
    try {
      const response = await fetch(`/api/teams/${id}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to deploy team");
      }

      await loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deploy team");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (error && !team) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link href="/teams">
            <Button variant="outline">Back to Teams</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Team not found</p>
      </div>
    );
  }

  const activeMember = team.members[activeAgentIndex];
  const activeAgent = agents.get(activeMember.agentId);

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    draft: { label: "Draft", variant: "outline" },
    active: { label: "Active", variant: "default" },
    archived: { label: "Archived", variant: "secondary" },
  };
  const status = statusConfig[team.status] || statusConfig.draft;

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link href="/teams">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200">
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back
              </Button>
            </Link>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
              <Users className="h-4 w-4 text-zinc-300" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-100">{team.name}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeploy}
              className="text-zinc-300 border-zinc-700"
            >
              <Rocket className="h-4 w-4 mr-1.5" />
              Deploy
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Left Panel - Chat */}
        <div className="flex-1 flex flex-col border-r border-zinc-800">
          {/* Agent Tabs */}
          <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-3">
            <Tabs value={activeAgentIndex.toString()} onValueChange={(v) => setActiveAgentIndex(parseInt(v))}>
              <TabsList className="bg-zinc-800">
                {team.members.map((member, index) => {
                  const agent = agents.get(member.agentId);
                  const config = agent?.config || {};
                  const identity = (config.identity as Record<string, unknown>) || {};
                  const emoji = identity.emoji ? String(identity.emoji) : null;

                  return (
                    <TabsTrigger key={member.id} value={index.toString()} className="gap-1.5">
                      {emoji && <span className="text-sm">{emoji}</span>}
                      <span className="text-sm">{member.agentName}</span>
                      {member.role === "orchestrator" && (
                        <Badge variant="outline" className="ml-1.5 text-[9px] px-1">Lead</Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>

          {/* Chat Area */}
          <div className="flex-1">
            {activeAgent && (
              <ChatPanel
                agentId={activeAgent.id}
                lettaAgentId={activeMember.lettaAgentId}
              />
            )}
          </div>
        </div>

        {/* Right Sidebar - Shared Memory & Activity */}
        <div className="w-80 bg-zinc-900 border-l border-zinc-800 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Shared Memory */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-zinc-400" />
                Shared Memory
              </h3>
              {memoryBlocks.length > 0 ? (
                <div className="space-y-3">
                  {memoryBlocks.map((block, index) => (
                    <Card key={index} className="bg-zinc-800 border-zinc-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-zinc-300 uppercase">
                          {block.label.replace("_", " ")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-zinc-400 whitespace-pre-wrap">
                          {block.value || "Empty"}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-zinc-800 border-zinc-700">
                  <CardContent className="py-6 text-center">
                    <p className="text-xs text-zinc-500">
                      No shared memory blocks yet
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Projects */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-zinc-400" />
                  Projects
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProjectForm(!showProjectForm)}
                  className="h-6 px-2 text-xs"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              {showProjectForm && (
                <Card className="bg-zinc-800 border-zinc-700 mb-3">
                  <CardContent className="pt-4 space-y-3">
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Project name"
                      className="bg-zinc-900 border-zinc-700 text-zinc-100 text-sm h-8"
                    />
                    <Textarea
                      value={projectBrief}
                      onChange={(e) => setProjectBrief(e.target.value)}
                      placeholder="Brief description..."
                      className="bg-zinc-900 border-zinc-700 text-zinc-100 text-sm min-h-[60px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleCreateProject}
                        disabled={isCreatingProject || !projectName.trim()}
                        className="flex-1 h-7 text-xs"
                      >
                        {isCreatingProject ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Create"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowProjectForm(false)}
                        className="h-7 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {team.projects.length > 0 ? (
                <div className="space-y-2">
                  {team.projects.map((project) => (
                    <Card key={project.id} className="bg-zinc-800 border-zinc-700">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-1">
                          <p className="text-sm font-medium text-zinc-100">{project.name}</p>
                          <Badge variant="outline" className="text-[9px] px-1">
                            {project.status}
                          </Badge>
                        </div>
                        {project.brief && (
                          <p className="text-xs text-zinc-400 line-clamp-2">
                            {project.brief}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-zinc-800 border-zinc-700">
                  <CardContent className="py-6 text-center">
                    <p className="text-xs text-zinc-500 mb-2">
                      No projects yet
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowProjectForm(true)}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Create First Project
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Activity Feed */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-zinc-400" />
                Recent Activity
              </h3>
              {activityLog.length > 0 ? (
                <div className="space-y-2">
                  {activityLog.map((entry, idx) => (
                    <div
                      key={`${entry.timestamp}-${idx}`}
                      className="text-xs text-zinc-400 pb-2 border-b border-zinc-800 last:border-0"
                    >
                      <p className="text-zinc-300 mb-0.5">{entry.message}</p>
                      <p className="text-zinc-500">
                        {entry.type} · {new Date(entry.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <Card className="bg-zinc-800 border-zinc-700">
                  <CardContent className="py-6 text-center">
                    <p className="text-xs text-zinc-500">
                      No activity yet
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-red-900/20 border border-red-900/30 p-3 text-sm text-red-400 max-w-md">
          {error}
        </div>
      )}
    </div>
  );
}
