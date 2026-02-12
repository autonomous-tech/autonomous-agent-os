"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  Wrench,
  Zap,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────

export interface McpServer {
  id: string;
  name: string;
  transport: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  status: "active" | "inactive";
  toolCount?: number;
}

interface McpServerPanelProps {
  projectId: string;
  servers: McpServer[];
  onServersChange: (servers: McpServer[]) => void;
}

// ── Presets ──────────────────────────────────────────────────────────

interface Preset {
  label: string;
  name: string;
  transport: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  url?: string;
}

const PRESETS: Record<string, Preset> = {
  filesystem: {
    label: "Filesystem",
    name: "filesystem",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
  },
  "jira-cloud": {
    label: "Jira Cloud",
    name: "jira-cloud",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-jira"],
  },
  git: {
    label: "Git",
    name: "git",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-git"],
  },
  browser: {
    label: "Browser",
    name: "browser",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
  },
  custom: {
    label: "Custom",
    name: "",
    transport: "stdio",
  },
};

// ── Add Server Form ─────────────────────────────────────────────────

interface AddServerFormState {
  preset: string;
  name: string;
  transport: "stdio" | "sse" | "http";
  command: string;
  args: string;
  url: string;
  envEntries: Array<{ key: string; value: string }>;
}

const INITIAL_FORM: AddServerFormState = {
  preset: "custom",
  name: "",
  transport: "stdio",
  command: "",
  args: "",
  url: "",
  envEntries: [],
};

// ── Component ───────────────────────────────────────────────────────

export function McpServerPanel({
  projectId,
  servers,
  onServersChange,
}: McpServerPanelProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [form, setForm] = useState<AddServerFormState>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [visibleEnvKeys, setVisibleEnvKeys] = useState<Set<string>>(new Set());

  // ── Preset selection ──────────────────────────────────────────────

  function applyPreset(presetKey: string) {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    setForm({
      preset: presetKey,
      name: preset.name,
      transport: preset.transport,
      command: preset.command || "",
      args: preset.args?.join(" ") || "",
      url: preset.url || "",
      envEntries: [],
    });
  }

  // ── Env helpers ───────────────────────────────────────────────────

  function addEnvEntry() {
    setForm((prev) => ({
      ...prev,
      envEntries: [...prev.envEntries, { key: "", value: "" }],
    }));
  }

  function updateEnvEntry(idx: number, field: "key" | "value", val: string) {
    setForm((prev) => ({
      ...prev,
      envEntries: prev.envEntries.map((e, i) =>
        i === idx ? { ...e, [field]: val } : e
      ),
    }));
  }

  function removeEnvEntry(idx: number) {
    setForm((prev) => ({
      ...prev,
      envEntries: prev.envEntries.filter((_, i) => i !== idx),
    }));
  }

  function toggleEnvVisibility(key: string) {
    setVisibleEnvKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── CRUD operations ───────────────────────────────────────────────

  async function handleAddServer() {
    if (!form.name.trim()) return;
    setIsSaving(true);

    const env: Record<string, string> = {};
    for (const entry of form.envEntries) {
      if (entry.key.trim()) {
        env[entry.key.trim()] = entry.value;
      }
    }

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      transport: form.transport,
      status: "active",
    };

    if (form.transport === "stdio") {
      body.command = form.command.trim();
      body.args = form.args
        .split(" ")
        .map((a) => a.trim())
        .filter(Boolean);
    } else {
      body.url = form.url.trim();
    }

    if (Object.keys(env).length > 0) {
      body.env = env;
    }

    try {
      const res = await fetch(`/api/agents/${projectId}/mcp-servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to add server");
      const data = await res.json();
      onServersChange([...servers, data.server]);
      setShowAddDialog(false);
      setForm(INITIAL_FORM);
    } catch (err) {
      console.error("Failed to add MCP server:", err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleStatus(server: McpServer) {
    const newStatus = server.status === "active" ? "inactive" : "active";
    try {
      const res = await fetch(
        `/api/agents/${projectId}/mcp-servers/${server.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (!res.ok) throw new Error("Failed to update server");
      onServersChange(
        servers.map((s) => (s.id === server.id ? { ...s, status: newStatus } : s))
      );
    } catch (err) {
      console.error("Failed to toggle server status:", err);
    }
  }

  async function handleDelete(serverId: string) {
    try {
      const res = await fetch(
        `/api/agents/${projectId}/mcp-servers/${serverId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete server");
      onServersChange(servers.filter((s) => s.id !== serverId));
    } catch (err) {
      console.error("Failed to delete MCP server:", err);
    }
  }

  async function handleTestConnection(server: McpServer) {
    setTestingId(server.id);
    try {
      const res = await fetch(
        `/api/agents/${projectId}/mcp-servers/${server.id}/test`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Connection test failed");
      const data = await res.json();
      onServersChange(
        servers.map((s) =>
          s.id === server.id ? { ...s, toolCount: data.toolCount } : s
        )
      );
    } catch (err) {
      console.error("Connection test failed:", err);
    } finally {
      setTestingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5 text-muted-foreground" />
          MCP Servers
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Server
        </Button>
      </div>

      {/* Server list */}
      {servers.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No MCP servers configured. Add one to give your agent executable
          tools.
        </p>
      ) : (
        <ScrollArea className="max-h-64">
          <div className="flex flex-col gap-2">
            {servers.map((server) => (
              <div
                key={server.id}
                className="rounded-md border p-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        server.status === "active"
                          ? "bg-green-500"
                          : "bg-muted-foreground/30"
                      )}
                    />
                    <span className="text-sm font-medium">{server.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {server.transport}
                    </Badge>
                    {server.toolCount !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {server.toolCount} tool{server.toolCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      size="sm"
                      checked={server.status === "active"}
                      onCheckedChange={() => handleToggleStatus(server)}
                    />
                    <button
                      type="button"
                      onClick={() => handleDelete(server.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Connection details */}
                <div className="text-xs text-muted-foreground">
                  {server.transport === "stdio" ? (
                    <span className="font-mono">
                      {server.command}{" "}
                      {server.args?.join(" ")}
                    </span>
                  ) : (
                    <span className="font-mono">{server.url}</span>
                  )}
                </div>

                {/* Test connection */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => handleTestConnection(server)}
                    disabled={testingId === server.id}
                  >
                    {testingId === server.id ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Zap className="h-3 w-3 mr-1" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Add Server Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add MCP Server</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* Preset selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Preset
              </label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <Button
                    key={key}
                    variant={form.preset === key ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => applyPreset(key)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Server Name
              </label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="my-server"
                className="h-8 text-sm"
              />
            </div>

            {/* Transport */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Transport
              </label>
              <div className="flex gap-1.5">
                {(["stdio", "sse", "http"] as const).map((t) => (
                  <Button
                    key={t}
                    variant={form.transport === t ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-2.5 text-xs font-mono"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, transport: t }))
                    }
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>

            {/* Command / URL */}
            {form.transport === "stdio" ? (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Command
                  </label>
                  <Input
                    value={form.command}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, command: e.target.value }))
                    }
                    placeholder="npx"
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Arguments
                  </label>
                  <Input
                    value={form.args}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, args: e.target.value }))
                    }
                    placeholder="-y @modelcontextprotocol/server-xyz"
                    className="h-8 text-sm font-mono"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  URL
                </label>
                <Input
                  value={form.url}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, url: e.target.value }))
                  }
                  placeholder="http://localhost:3001/sse"
                  className="h-8 text-sm font-mono"
                />
              </div>
            )}

            <Separator />

            {/* Environment Variables */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Environment Variables
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={addEnvEntry}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
              {form.envEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground/60">
                  No environment variables set.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {form.envEntries.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <Input
                        value={entry.key}
                        onChange={(e) =>
                          updateEnvEntry(idx, "key", e.target.value)
                        }
                        placeholder="KEY"
                        className="h-7 text-xs font-mono flex-1"
                      />
                      <div className="relative flex-1">
                        <Input
                          value={entry.value}
                          onChange={(e) =>
                            updateEnvEntry(idx, "value", e.target.value)
                          }
                          type={
                            visibleEnvKeys.has(`${idx}`) ? "text" : "password"
                          }
                          placeholder="value"
                          className="h-7 text-xs font-mono pr-7"
                        />
                        <button
                          type="button"
                          onClick={() => toggleEnvVisibility(`${idx}`)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {visibleEnvKeys.has(`${idx}`) ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEnvEntry(idx)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddDialog(false);
                setForm(INITIAL_FORM);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddServer}
              disabled={!form.name.trim() || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Wrench className="h-3.5 w-3.5 mr-1" />
                  Add Server
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
