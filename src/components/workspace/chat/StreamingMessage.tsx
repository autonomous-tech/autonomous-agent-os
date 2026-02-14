"use client";

import { useState } from "react";
import { ChatMessage } from "@/stores/chat-store";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolCallInline } from "./ToolCallInline";

interface StreamingMessageProps {
  message: ChatMessage;
}

export function StreamingMessage({ message }: StreamingMessageProps) {
  const [reasoningOpen, setReasoningOpen] = useState(false);

  const isUser = message.role === "user";

  // Simple markdown-like rendering with HTML escaping to prevent XSS
  const renderContent = (content: string) => {
    // Escape HTML entities first to prevent injection
    let rendered = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    // Bold: **text**
    rendered = rendered.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');

    // Italic: *text*
    rendered = rendered.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

    // Code: `code`
    rendered = rendered.replace(
      /`(.*?)`/g,
      '<code class="rounded bg-zinc-800 px-1 py-0.5 text-sm font-mono">$1</code>'
    );

    // Line breaks
    rendered = rendered.replace(/\n/g, "<br />");

    return rendered;
  };

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800">
          <Bot className="h-4 w-4 text-zinc-400" />
        </div>
      )}

      {/* Message Content */}
      <div className={cn("max-w-[80%] space-y-2", isUser && "order-first")}>
        {/* Main Content Bubble */}
        <div
          className={cn(
            "rounded-lg px-4 py-3",
            isUser
              ? "bg-blue-600 text-white"
              : "bg-zinc-800 text-zinc-100"
          )}
        >
          <div
            dangerouslySetInnerHTML={{ __html: renderContent(message.content) }}
            className="text-sm leading-relaxed"
          />
          {message.isStreaming && (
            <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current" />
          )}
        </div>

        {/* Reasoning Section */}
        {message.reasoning && (
          <Collapsible open={reasoningOpen} onOpenChange={setReasoningOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-400">
              {reasoningOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Thinking process
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="rounded-lg bg-zinc-900 p-3 text-xs text-zinc-400">
                {message.reasoning}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Tool Calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-2">
            {message.toolCalls.map((toolCall) => (
              <ToolCallInline key={toolCall.id} toolCall={toolCall} />
            ))}
          </div>
        )}

        {/* Memory Updates */}
        {message.memoryUpdates && message.memoryUpdates.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.memoryUpdates.map((update, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="border-zinc-700 bg-zinc-800/50 text-xs text-zinc-400"
              >
                {update.action}: {update.label}
              </Badge>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className="text-xs text-zinc-600">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600">
          <User className="h-4 w-4 text-white" />
        </div>
      )}
    </div>
  );
}
