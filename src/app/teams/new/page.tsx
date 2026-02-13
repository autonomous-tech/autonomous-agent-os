"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Plus, X, Loader2 } from "lucide-react";
import { generateSlug } from "@/lib/slug";

interface Agent {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  config: string;
}

export default function NewTeamPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [agentsLoaded, setAgentsLoaded] = useState(false);

  const loadAgents = async () => {
    if (agentsLoaded) return;

    setIsLoadingAgents(true);
    setError("");

    try {
      const response = await fetch("/api/agents");
      if (!response.ok) {
        throw new Error(`Failed to fetch agents: ${response.status}`);
      }

      const data = await response.json();
      setAgents(data);
      setAgentsLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setIsLoadingAgents(false);
    }
  };

  const toggleAgent = (agentId: string) => {
    const newSelected = new Set(selectedAgentIds);
    if (newSelected.has(agentId)) {
      newSelected.delete(agentId);
    } else {
      newSelected.add(agentId);
    }
    setSelectedAgentIds(newSelected);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Team name is required");
      return;
    }

    if (selectedAgentIds.size === 0) {
      setError("Please select at least one agent");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const slug = generateSlug(name) + "-" + Date.now().toString(36);

      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug,
          description: description.trim(),
          agentIds: Array.from(selectedAgentIds),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create team: ${response.status}`);
      }

      const team = await response.json();
      router.push(`/teams/${team.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
      setIsCreating(false);
    }
  };

  const selectedAgents = agents.filter((a) => selectedAgentIds.has(a.id));

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
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
            <h1 className="text-lg font-bold tracking-tight text-zinc-100">New Team</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="space-y-6">
          {/* Basic Info */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-base text-zinc-100">Team Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="name" className="text-sm font-medium text-zinc-300 mb-1.5 block">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Engineering Squad"
                  className="bg-zinc-800 border-zinc-700 text-zinc-100"
                  maxLength={100}
                />
              </div>
              <div>
                <label htmlFor="description" className="text-sm font-medium text-zinc-300 mb-1.5 block">
                  Description
                </label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A team of specialized agents working together..."
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 min-h-[80px]"
                  maxLength={500}
                />
              </div>
            </CardContent>
          </Card>

          {/* Agent Selection */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-zinc-100">Team Members</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadAgents}
                  disabled={isLoadingAgents || agentsLoaded}
                  className="text-zinc-300 border-zinc-700"
                >
                  {isLoadingAgents ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Loading...
                    </>
                  ) : agentsLoaded ? (
                    "Loaded"
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Load Agents
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selected agents roster */}
              {selectedAgents.length > 0 && (
                <div className="pb-4 border-b border-zinc-800">
                  <p className="text-xs text-zinc-400 mb-3">
                    Selected ({selectedAgents.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedAgents.map((agent) => {
                      const config = JSON.parse(agent.config || "{}");
                      const identity = config.identity || {};

                      return (
                        <Badge
                          key={agent.id}
                          variant="secondary"
                          className="bg-zinc-800 text-zinc-200 border-zinc-700 flex items-center gap-1.5 pr-1"
                        >
                          {identity.emoji && <span>{identity.emoji}</span>}
                          <span>{agent.name}</span>
                          <button
                            onClick={() => toggleAgent(agent.id)}
                            className="hover:bg-zinc-700 rounded p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Available agents list */}
              {agentsLoaded && (
                <div>
                  <p className="text-xs text-zinc-400 mb-3">
                    Available Agents ({agents.length})
                  </p>
                  {agents.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-sm">
                      No agents available. Create an agent first.
                    </div>
                  ) : (
                    <div className="grid gap-2 max-h-[400px] overflow-y-auto">
                      {agents.map((agent) => {
                        const config = JSON.parse(agent.config || "{}");
                        const identity = config.identity || {};
                        const isSelected = selectedAgentIds.has(agent.id);

                        return (
                          <button
                            key={agent.id}
                            onClick={() => toggleAgent(agent.id)}
                            className={`text-left p-3 rounded-lg border transition-all ${
                              isSelected
                                ? "bg-zinc-800 border-zinc-600"
                                : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {identity.emoji && (
                                  <span className="text-lg">{identity.emoji}</span>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-zinc-100 truncate">
                                    {agent.name}
                                  </p>
                                  {agent.description && (
                                    <p className="text-xs text-zinc-400 truncate">
                                      {agent.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">
                                  {agent.status}
                                </Badge>
                                {isSelected && (
                                  <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {!agentsLoaded && !isLoadingAgents && (
                <div className="text-center py-8 text-zinc-500 text-sm">
                  Click "Load Agents" to select team members
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-red-900/20 border border-red-900/30 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link href="/teams">
              <Button variant="ghost" className="text-zinc-400 hover:text-zinc-200">
                Cancel
              </Button>
            </Link>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !name.trim() || selectedAgentIds.size === 0}
              className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create Team
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
