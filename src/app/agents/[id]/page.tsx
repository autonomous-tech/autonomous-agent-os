"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { TestChat } from "@/components/builder/TestChat";
import { ClaudeCodeExportDialog } from "@/components/builder/ClaudeCodeExportDialog";
import { LivePreview } from "@/components/builder/LivePreview";
import {
  IdentityCard,
  PurposeCard,
  AudienceCard,
  WorkflowCard,
  MemoryCard,
  BoundariesCard,
} from "@/components/builder/cards";
import {
  ArrowLeft,
  Save,
  Loader2,
  MessageSquare,
  Play,
  Rocket,
  Pause,
  RefreshCw,
  Terminal,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import type {
  AgentConfig,
  StageData,
  AiCallout,
  EnrichmentResponse,
  SectionName,
  CalloutHandlers,
  MissionConfig,
  IdentityConfig,
  CapabilitiesConfig,
  TriggersConfig,
  MemoryConfig,
  GuardrailsConfig,
} from "@/lib/types";
import { defaultStageData } from "@/lib/types";

interface AgentData {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  config: AgentConfig;
  stages: StageData;
  lettaAgentId?: string | null;
}

export default function AgentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [agent, setAgent] = useState<AgentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<AgentConfig>({});
  const [stages, setStages] = useState<StageData>(defaultStageData());
  const [isSaving, setIsSaving] = useState(false);

  // Deploy state
  const [deployment, setDeployment] = useState<{
    id: string;
    status: string;
    version: number;
    createdAt: string;
    lettaAgentId?: string;
  } | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showDeploySuccess, setShowDeploySuccess] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState("");
  const [deployError, setDeployError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // UI state
  const [showTestChat, setShowTestChat] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // AI callouts per section
  const [callouts, setCallouts] = useState<Record<string, AiCallout[]>>({});
  const [enrichingSections, setEnrichingSections] = useState<Set<string>>(new Set());
  const enrichTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
      for (const timeout of Object.values(enrichTimeoutRef.current)) {
        clearTimeout(timeout);
      }
    };
  }, []);

  // Warn on unsaved changes (pending auto-save)
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (autoSaveRef.current) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Fetch agent
  useEffect(() => {
    async function fetchAgent() {
      try {
        const res = await fetch(`/api/agents/${id}`);
        if (!res.ok) {
          if (res.status === 404) { router.push("/"); return; }
          throw new Error("Failed to fetch agent");
        }
        const data = await res.json();
        setAgent(data);
        setConfig(data.config || {});
        setStages(data.stages || defaultStageData());

        try {
          const deployRes = await fetch(`/api/agents/${id}/deploy`);
          if (deployRes.ok) {
            const deployData = await deployRes.json();
            setDeployment(deployData.deployment);
          }
        } catch (err) {
          console.warn("Failed to fetch deployment status:", err);
        }
      } catch (error) {
        console.error("Failed to fetch agent:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAgent();
  }, [id, router]);

  // Save
  const [saveError, setSaveError] = useState<string | null>(null);
  const save = useCallback(async () => {
    if (!agent) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config,
          stages,
          name: config.identity?.name || agent.name,
        }),
      });
      if (!res.ok) {
        setSaveError("Failed to save changes.");
      }
    } catch (error) {
      console.error("Failed to save:", error);
      setSaveError("Failed to save. Check your connection.");
    } finally {
      setIsSaving(false);
    }
  }, [id, agent, config, stages]);

  // Debounced auto-save
  const triggerAutoSave = useCallback(() => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => { save(); }, 3000);
  }, [save]);

  // Enrichment
  const triggerEnrichment = useCallback(
    (section: SectionName, sectionData: Record<string, unknown>) => {
      // Clear previous timeout for this section
      if (enrichTimeoutRef.current[section]) {
        clearTimeout(enrichTimeoutRef.current[section]);
      }

      enrichTimeoutRef.current[section] = setTimeout(async () => {
        setEnrichingSections((prev) => new Set(prev).add(section));
        try {
          const res = await fetch(`/api/agents/${id}/enrich`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ section, sectionData, fullConfig: configRef.current }),
          });
          if (!res.ok) return;
          const data: EnrichmentResponse = await res.json();

          const newCallouts: AiCallout[] = [
            ...data.suggestions.map((s, i) => ({ id: `${section}-s-${i}`, type: "suggestion" as const, data: s })),
            ...data.ideas.map((d, i) => ({ id: `${section}-i-${i}`, type: "idea" as const, data: d })),
            ...data.questions.map((q, i) => ({ id: `${section}-q-${i}`, type: "question" as const, data: q })),
          ];

          if (newCallouts.length > 0) {
            setCallouts((prev) => ({ ...prev, [section]: newCallouts }));
          }
        } catch (err) {
          console.warn(`[enrich] Failed for section ${section}:`, err);
        } finally {
          setEnrichingSections((prev) => {
            const next = new Set(prev);
            next.delete(section);
            return next;
          });
        }
      }, 1500);
    },
    [id]
  );

  function dismissCallout(section: string, calloutId: string) {
    setCallouts((prev) => ({
      ...prev,
      [section]: (prev[section] || []).filter((c) => c.id !== calloutId),
    }));
  }

  function acceptCallout(section: string, calloutId: string) {
    const callout = callouts[section]?.find((c) => c.id === calloutId);
    if (!callout) return;

    if (callout.type === "suggestion") {
      const suggestion = callout.data as { field: string; improved: string };
      // Apply the suggestion to the appropriate config section
      updateConfigField(section as SectionName, suggestion.field, suggestion.improved);
    } else if (callout.type === "idea") {
      const idea = callout.data as { type: string; value: string | Record<string, unknown> };
      applyIdea(section as SectionName, idea);
    }

    dismissCallout(section, calloutId);
  }

  function answerCallout(section: string, calloutId: string, answer: string) {
    dismissCallout(section, calloutId);
    // Re-trigger enrichment with the answer as context
    const sectionData = getSectionData(section as SectionName);
    triggerEnrichment(section as SectionName, { ...sectionData, _answer: answer });
  }

  function updateConfigField(section: SectionName, field: string, value: unknown) {
    setConfig((prev) => {
      const sectionMap: Record<SectionName, keyof AgentConfig> = {
        identity: "identity",
        purpose: "mission",
        audience: "mission",
        workflow: "capabilities",
        memory: "memory",
        boundaries: "guardrails",
      };
      const configKey = sectionMap[section];
      const current = (prev[configKey] || {}) as Record<string, unknown>;
      return { ...prev, [configKey]: { ...current, [field]: value } };
    });
  }

  function applyIdea(section: SectionName, idea: { type: string; value: string | Record<string, unknown> }) {
    setConfig((prev) => {
      const next = { ...prev };
      if (idea.type === "task") {
        const mission = { ...next.mission };
        mission.tasks = [...(mission.tasks || []), idea.value as string];
        next.mission = mission;
      } else if (idea.type === "capability") {
        const caps = { ...next.capabilities };
        const tool = typeof idea.value === "string"
          ? { name: idea.value, access: "read-only" as const, description: "" }
          : idea.value as { name: string; access: "read-only" | "write" | "full"; description: string };
        caps.tools = [...(caps.tools || []), tool];
        next.capabilities = caps;
      } else if (idea.type === "guardrail") {
        const g = { ...next.guardrails };
        g.behavioral = [...(g.behavioral || []), idea.value as string];
        next.guardrails = g;
      } else if (idea.type === "remember") {
        const m = { ...next.memory };
        m.remember = [...(m.remember || []), idea.value as string];
        next.memory = m;
      }
      return next;
    });
  }

  function getSectionData(section: SectionName): Record<string, unknown> {
    const map: Record<SectionName, () => Record<string, unknown>> = {
      identity: () => (config.identity || {}) as Record<string, unknown>,
      purpose: () => ({ description: config.mission?.description, tasks: config.mission?.tasks }),
      audience: () => (config.mission?.audience || {}) as Record<string, unknown>,
      workflow: () => ({ capabilities: config.capabilities, triggers: config.triggers }),
      memory: () => (config.memory || {}) as Record<string, unknown>,
      boundaries: () => ({ guardrails: config.guardrails, exclusions: config.mission?.exclusions }),
    };
    return map[section]();
  }

  // Section update handlers
  function updateIdentity(identity: IdentityConfig) {
    setConfig((prev) => ({ ...prev, identity }));
    triggerAutoSave();
    triggerEnrichment("identity", identity as unknown as Record<string, unknown>);
  }

  function updateMission(mission: MissionConfig) {
    setConfig((prev) => ({ ...prev, mission: { ...prev.mission, ...mission } }));
    triggerAutoSave();
    triggerEnrichment("purpose", { description: mission.description, tasks: mission.tasks });
  }

  function updateAudience(audience: MissionConfig["audience"]) {
    setConfig((prev) => ({ ...prev, mission: { ...prev.mission, audience } }));
    triggerAutoSave();
    triggerEnrichment("audience", (audience || {}) as Record<string, unknown>);
  }

  function updateCapabilities(capabilities: CapabilitiesConfig) {
    setConfig((prev) => ({ ...prev, capabilities }));
    triggerAutoSave();
    triggerEnrichment("workflow", { capabilities, triggers: config.triggers });
  }

  function updateTriggers(triggers: TriggersConfig) {
    setConfig((prev) => ({ ...prev, triggers }));
    triggerAutoSave();
  }

  function updateMemory(memory: MemoryConfig) {
    setConfig((prev) => ({ ...prev, memory }));
    triggerAutoSave();
    triggerEnrichment("memory", memory as unknown as Record<string, unknown>);
  }

  function updateGuardrails(guardrails: GuardrailsConfig) {
    setConfig((prev) => ({ ...prev, guardrails }));
    triggerAutoSave();
    triggerEnrichment("boundaries", { guardrails, exclusions: config.mission?.exclusions });
  }

  function updateExclusions(exclusions: string[]) {
    setConfig((prev) => ({ ...prev, mission: { ...prev.mission, exclusions } }));
    triggerAutoSave();
  }

  function calloutHandlersFor(section: SectionName): CalloutHandlers & { enriching: boolean } {
    return {
      callouts: callouts[section],
      onAcceptCallout: (cid) => acceptCallout(section, cid),
      onDismissCallout: (cid) => dismissCallout(section, cid),
      onAnswerCallout: (cid, a) => answerCallout(section, cid, a),
      enriching: enrichingSections.has(section),
    };
  }

  // Deploy
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
        setDeployError(data.error || "Deploy failed.");
      }
    } catch {
      setDeployError("Deploy failed.");
    } finally {
      setIsDeploying(false);
    }
  }, [agent, id, save]);

  const handlePause = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${id}/deploy`, { method: "DELETE" });
      if (res.ok) {
        setDeployment((prev) => prev ? { ...prev, status: "paused" } : null);
      } else {
        setDeployError("Failed to pause agent.");
      }
    } catch {
      setDeployError("Failed to pause agent. Check your connection.");
    }
  }, [id]);

  const handleResume = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${id}/deploy`, { method: "PATCH" });
      if (res.ok) {
        setDeployment((prev) => prev ? { ...prev, status: "active" } : null);
      } else {
        setDeployError("Failed to resume agent.");
      }
    } catch {
      setDeployError("Failed to resume agent. Check your connection.");
    }
  }, [id]);

  const hasContent = !!(
    config.identity?.name ||
    config.mission?.description ||
    (config.mission?.tasks && config.mission.tasks.length > 0)
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-zinc-950">
        <p className="text-zinc-400">Agent not found.</p>
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
          Return to dashboard
        </Link>
      </div>
    );
  }

  if (showTestChat) {
    return (
      <TestChat
        projectId={id}
        config={config}
        onExit={() => setShowTestChat(false)}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 px-4 gap-2 overflow-x-auto">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Agents</span>
          </Link>
          <span className="text-sm text-zinc-600">/</span>
          <div className="flex items-center gap-2">
            {config.identity?.emoji && (
              <span className="text-base">{config.identity.emoji}</span>
            )}
            <span className="text-sm font-medium text-zinc-200 truncate max-w-[200px]">
              {config.identity?.name || agent.name}
            </span>
            <span className="text-xs text-zinc-500 font-mono">/{agent.slug}</span>
          </div>
          {deployment?.status === "active" && (
            <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-400 border-green-500/20">
              Live v{deployment.version}
            </Badge>
          )}
          {deployment?.status === "paused" && (
            <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
              Paused
            </Badge>
          )}
          {agent.status === "deployed" && (
            <Link
              href={`/agents/${id}/workspace`}
              className="ml-1 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <MessageSquare className="h-3 w-3" />
              Workspace
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setShowTestChat(true)}
            disabled={!hasContent}
          >
            <Play className="h-3.5 w-3.5 mr-1" />
            Try It
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setShowExport(true)}
            disabled={!hasContent}
          >
            <Terminal className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
          {!deployment || deployment.status === "retired" ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleDeploy}
              disabled={isDeploying || !hasContent}
            >
              {isDeploying ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Rocket className="h-3.5 w-3.5 mr-1" />}
              Deploy
            </Button>
          ) : deployment.status === "active" ? (
            <>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handlePause}>
                <Pause className="h-3.5 w-3.5 mr-1" />
                Pause
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleDeploy} disabled={isDeploying}>
                {isDeploying ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                Redeploy
              </Button>
            </>
          ) : deployment.status === "paused" ? (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleResume}>
              <Play className="h-3.5 w-3.5 mr-1" />
              Resume
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={save} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Save
          </Button>
        </div>
      </header>

      {/* Error banners */}
      {(deployError || saveError) && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-between">
          <p className="text-xs text-red-400">{deployError || saveError}</p>
          <button
            type="button"
            onClick={() => { setDeployError(null); setSaveError(null); }}
            className="text-red-400 hover:text-red-300 text-xs ml-4 shrink-0"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2-column layout */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left: Section cards */}
        <ScrollArea className="w-full lg:w-3/5 lg:border-r border-zinc-800">
          <div className="p-4 sm:p-6 space-y-4 max-w-2xl mx-auto">
            <IdentityCard
              config={config.identity || {}}
              onChange={updateIdentity}
              {...calloutHandlersFor("identity")}
            />

            <PurposeCard
              config={config.mission || {}}
              onChange={updateMission}
              {...calloutHandlersFor("purpose")}
            />

            <AudienceCard
              audience={config.mission?.audience}
              onChange={updateAudience}
              {...calloutHandlersFor("audience")}
            />

            <WorkflowCard
              capabilities={config.capabilities || {}}
              triggers={config.triggers || {}}
              onCapabilitiesChange={updateCapabilities}
              onTriggersChange={updateTriggers}
              {...calloutHandlersFor("workflow")}
            />

            <MemoryCard
              config={config.memory || {}}
              onChange={updateMemory}
              {...calloutHandlersFor("memory")}
            />

            <BoundariesCard
              guardrails={config.guardrails || {}}
              exclusions={config.mission?.exclusions || []}
              onGuardrailsChange={updateGuardrails}
              onExclusionsChange={updateExclusions}
              {...calloutHandlersFor("boundaries")}
            />
          </div>
        </ScrollArea>

        {/* Right: Live preview */}
        <div className="hidden lg:flex flex-1 flex-col">
          <LivePreview
            slug={agent.slug}
            config={config}
            lettaAgentId={agent.lettaAgentId}
          />
        </div>
      </div>

      {/* Export dialog */}
      <ClaudeCodeExportDialog
        open={showExport}
        onOpenChange={setShowExport}
        projectId={id}
      />

      {/* Deploy success dialog */}
      <Dialog open={showDeploySuccess} onOpenChange={(open) => { if (!open) setShowDeploySuccess(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
              Agent Deployed
            </DialogTitle>
            <DialogDescription>
              Your agent is now live and accessible.
            </DialogDescription>
          </DialogHeader>
          {deployedUrl && (
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono truncate">
                {deployedUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(deployedUrl).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeploySuccess(false)}>Close</Button>
            {deployedUrl && (
              <Button onClick={() => window.open(deployedUrl, "_blank")}>
                <ExternalLink className="h-4 w-4 mr-2" /> Open Agent
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
