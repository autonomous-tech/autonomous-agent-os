"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useChatStore } from "@/stores/chat-store";
import {
  Wrench,
  CheckCircle2,
  XCircle,
  Server,
  Activity,
  Clock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolLogPanelProps {
  agentId: string;
}

interface McpServer {
  name: string;
  status: "connected" | "disconnected" | "error";
  toolCount: number;
  lastActivity?: string;
}

export function ToolLogPanel({ agentId }: ToolLogPanelProps) {
  const { messages } = useChatStore();
  const [servers, setServers] = useState<McpServer[]>([]);

  // Mock MCP server data - in production, fetch from API
  useEffect(() => {
    // Simulate fetching MCP server status
    setServers([
      {
        name: "filesystem",
        status: "connected",
        toolCount: 8,
        lastActivity: new Date(Date.now() - 120000).toISOString(),
      },
      {
        name: "web-search",
        status: "connected",
        toolCount: 3,
        lastActivity: new Date(Date.now() - 300000).toISOString(),
      },
      {
        name: "database",
        status: "disconnected",
        toolCount: 12,
      },
    ]);
  }, [agentId]);

  // Extract all tool calls from messages
  const allToolCalls = messages.flatMap((msg) => {
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      return msg.toolCalls.map((tc) => ({
        ...tc,
        timestamp: msg.timestamp,
        messageId: msg.id,
      }));
    }
    return [];
  });

  const getServerIcon = (status: McpServer["status"]) => {
    switch (status) {
      case "connected":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "disconnected":
        return <AlertCircle className="h-4 w-4 text-zinc-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: McpServer["status"]) => {
    const colors = {
      connected: "bg-green-900/20 text-green-400 border-green-900/30",
      disconnected: "bg-zinc-800 text-zinc-400 border-zinc-700",
      error: "bg-red-900/20 text-red-400 border-red-900/30",
    };

    return (
      <Badge variant="outline" className={cn("text-xs", colors[status])}>
        {status}
      </Badge>
    );
  };

  const formatDuration = (startTime: string) => {
    // Mock duration calculation - in production, calculate from actual execution time
    return `${Math.floor(Math.random() * 500) + 100}ms`;
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <ScrollArea className="flex-1">
        <div className="space-y-6 p-6">
          {/* MCP Server Status Section */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Server className="h-5 w-5 text-zinc-400" />
              <h2 className="text-lg font-semibold text-zinc-100">MCP Servers</h2>
            </div>

            <div className="space-y-2">
              {servers.map((server) => (
                <Card key={server.name} className="border-zinc-800 bg-zinc-900">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getServerIcon(server.status)}
                        <CardTitle className="text-sm font-medium text-zinc-100">
                          {server.name}
                        </CardTitle>
                      </div>
                      {getStatusBadge(server.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="py-2 pt-0">
                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                      <div className="flex items-center gap-1">
                        <Wrench className="h-3 w-3" />
                        <span>{server.toolCount} tools</span>
                      </div>
                      {server.lastActivity && (
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          <span>{formatRelativeTime(server.lastActivity)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Separator className="bg-zinc-800" />

          {/* Tool Execution Log Section */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-zinc-400" />
              <h2 className="text-lg font-semibold text-zinc-100">Execution Log</h2>
            </div>

            {allToolCalls.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-center">
                <Wrench className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
                <p className="text-sm text-zinc-500">No tool executions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allToolCalls.map((toolCall, idx) => (
                  <Card
                    key={`${toolCall.id}-${idx}`}
                    className={cn(
                      "border",
                      toolCall.status === "success"
                        ? "border-green-900/30 bg-zinc-900"
                        : toolCall.status === "error"
                          ? "border-red-900/30 bg-zinc-900"
                          : "border-zinc-800 bg-zinc-900"
                    )}
                  >
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {toolCall.status === "success" && (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                            {toolCall.status === "error" && (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            {toolCall.status === "pending" && (
                              <Clock className="h-4 w-4 animate-pulse text-zinc-500" />
                            )}
                            <span className="font-mono text-sm font-medium text-zinc-100">
                              {toolCall.name}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatDuration(toolCall.timestamp)}</span>
                            </div>
                            <div>{formatRelativeTime(toolCall.timestamp)}</div>
                            {/* Extract server from tool name (e.g., "filesystem_read" -> "filesystem") */}
                            <div className="flex items-center gap-1">
                              <Server className="h-3 w-3" />
                              <span>{toolCall.name.split("_")[0] || "unknown"}</span>
                            </div>
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            toolCall.status === "success" &&
                              "bg-green-900/20 text-green-400 border-green-900/30",
                            toolCall.status === "error" &&
                              "bg-red-900/20 text-red-400 border-red-900/30",
                            toolCall.status === "pending" &&
                              "bg-zinc-800 text-zinc-400 border-zinc-700"
                          )}
                        >
                          {toolCall.status || "pending"}
                        </Badge>
                      </div>

                      {toolCall.status === "error" && toolCall.result && (
                        <div className="mt-2 rounded bg-red-950/30 p-2 text-xs text-red-400">
                          {toolCall.result}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
