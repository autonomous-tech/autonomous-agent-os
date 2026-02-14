"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Check, Copy, Loader2, Terminal } from "lucide-react";

interface GeneratedFile {
  path: string;
  content: string;
}

interface ExportData {
  files: {
    agentMd: GeneratedFile;
    mcpJson: GeneratedFile;
    settingsJson: GeneratedFile;
    metadata: {
      slug: string;
      name: string;
      hasLetta: boolean;
    };
  };
}

interface ClaudeCodeExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function ClaudeCodeExportDialog({
  open,
  onOpenChange,
  projectId,
}: ClaudeCodeExportDialogProps) {
  const [agentOsUrl, setAgentOsUrl] = useState("http://localhost:3000");
  const [autoSync, setAutoSync] = useState(true);
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const fetchExport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ url: agentOsUrl });
      const res = await fetch(
        `/api/agents/${projectId}/claude-code-export?${params}`
      );
      if (!res.ok) throw new Error("Failed to generate export");
      const data = await res.json();
      setExportData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [projectId, agentOsUrl]);

  useEffect(() => {
    if (open) {
      fetchExport();
    }
  }, [open, fetchExport]);

  async function copyToClipboard(text: string, fileKey: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFile(fileKey);
      setTimeout(() => setCopiedFile(null), 2000);
    } catch {
      // Clipboard API may fail if page is not focused
    }
  }

  async function copyAllAsCommands() {
    if (!exportData) return;

    const { agentMd, mcpJson, settingsJson } = exportData.files;
    // Use unique heredoc delimiters unlikely to appear in content
    const commands = [
      `mkdir -p .claude/agents`,
      `cat > '${agentMd.path}' << '__AGENTMD_EOF_7f3a__'\n${agentMd.content}__AGENTMD_EOF_7f3a__`,
      `cat > '${mcpJson.path}' << '__MCPJSON_EOF_7f3a__'\n${mcpJson.content}__MCPJSON_EOF_7f3a__`,
      ...(autoSync
        ? [`cat > '${settingsJson.path}' << '__SETTINGS_EOF_7f3a__'\n${settingsJson.content}__SETTINGS_EOF_7f3a__`]
        : []),
    ];

    try {
      await navigator.clipboard.writeText(commands.join("\n\n"));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // Clipboard API may fail if page is not focused
    }
  }

  const files = exportData?.files;
  const hasLetta = files?.metadata.hasLetta;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Export to Claude Code
          </DialogTitle>
          <DialogDescription>
            Generate subagent files for Claude Code auto-discovery
            {hasLetta && " with persistent memory via MCP"}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Settings */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium min-w-[90px]">
                Agent OS URL
              </label>
              <Input
                value={agentOsUrl}
                onChange={(e) => setAgentOsUrl(e.target.value)}
                placeholder="http://localhost:3000"
                className="flex-1 font-mono text-xs"
                onBlur={fetchExport}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-sync memory</p>
                <p className="text-xs text-muted-foreground">
                  Run memory extraction after each agent session via SubagentStop
                  hook
                </p>
              </div>
              <Switch checked={autoSync} onCheckedChange={setAutoSync} />
            </div>
          </div>

          {/* File preview */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive text-center py-4">
              {error}
            </p>
          )}

          {files && !loading && (
            <>
              <Tabs defaultValue="agent" className="flex-1 min-h-0">
                <div className="flex items-center justify-between">
                  <TabsList>
                    <TabsTrigger value="agent">
                      Agent .md
                      {hasLetta && (
                        <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0">
                          MCP
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="mcp">.mcp.json</TabsTrigger>
                    {autoSync && (
                      <TabsTrigger value="settings">settings.json</TabsTrigger>
                    )}
                  </TabsList>
                </div>

                <TabsContent value="agent" className="mt-2">
                  <FilePreview
                    file={files.agentMd}
                    fileKey="agent"
                    copiedFile={copiedFile}
                    onCopy={copyToClipboard}
                  />
                </TabsContent>

                <TabsContent value="mcp" className="mt-2">
                  <FilePreview
                    file={files.mcpJson}
                    fileKey="mcp"
                    copiedFile={copiedFile}
                    onCopy={copyToClipboard}
                  />
                </TabsContent>

                {autoSync && (
                  <TabsContent value="settings" className="mt-2">
                    <FilePreview
                      file={files.settingsJson}
                      fileKey="settings"
                      copiedFile={copiedFile}
                      onCopy={copyToClipboard}
                    />
                  </TabsContent>
                )}
              </Tabs>

              {/* Setup instructions */}
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1.5">
                <p className="font-medium text-sm">Setup</p>
                <p className="font-mono text-muted-foreground">
                  npm install -g agent-os-mcp
                </p>
                <p className="text-muted-foreground">
                  Or add to your project&apos;s <code>.mcp.json</code> — the MCP
                  server starts automatically when Claude Code detects it.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={copyAllAsCommands}>
                  {copiedAll ? (
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {copiedAll ? "Copied!" : "Copy as Shell Commands"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── File preview sub-component ───────────────────────────────────────

interface FilePreviewProps {
  file: GeneratedFile;
  fileKey: string;
  copiedFile: string | null;
  onCopy: (content: string, key: string) => void;
}

function FilePreview({ file, fileKey, copiedFile, onCopy }: FilePreviewProps) {
  return (
    <div className="rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between px-3 py-1.5 border-b">
        <code className="text-xs text-muted-foreground">{file.path}</code>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => onCopy(file.content, fileKey)}
        >
          {copiedFile === fileKey ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      <ScrollArea className="max-h-[300px]">
        <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-words">
          {file.content}
        </pre>
      </ScrollArea>
    </div>
  );
}
