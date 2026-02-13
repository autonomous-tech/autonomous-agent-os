"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolCall {
  id: string;
  name: string;
  arguments: string;
  result?: string;
  status?: "pending" | "success" | "error";
}

interface ToolCallInlineProps {
  toolCall: ToolCall;
}

export function ToolCallInline({ toolCall }: ToolCallInlineProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatJSON = (json: string) => {
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  };

  const getStatusIcon = () => {
    switch (toolCall.status) {
      case "pending":
        return <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Wrench className="h-4 w-4 text-zinc-500" />;
    }
  };

  const getStatusColor = () => {
    switch (toolCall.status) {
      case "success":
        return "border-green-900/30 bg-green-900/10";
      case "error":
        return "border-red-900/30 bg-red-900/10";
      default:
        return "border-zinc-800 bg-zinc-900/50";
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn("border", getStatusColor())}>
        <CardHeader className="py-2 px-3">
          <CollapsibleTrigger className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <CardTitle className="text-sm font-medium text-zinc-200">
                {toolCall.name}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {toolCall.status || "pending"}
              </Badge>
            </div>
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-zinc-500" />
            )}
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-3 px-3 pb-3">
            {/* Input */}
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-500">Input</div>
              <pre className="overflow-x-auto rounded bg-zinc-950 p-2 text-xs text-zinc-300">
                {formatJSON(toolCall.arguments)}
              </pre>
            </div>

            {/* Output */}
            {toolCall.result && (
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-500">Output</div>
                <pre
                  className={cn(
                    "overflow-x-auto rounded p-2 text-xs",
                    toolCall.status === "error"
                      ? "bg-red-950/30 text-red-300"
                      : "bg-zinc-950 text-zinc-300"
                  )}
                >
                  {formatJSON(toolCall.result)}
                </pre>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
