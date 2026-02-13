"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/stores/chat-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { StreamingMessage } from "./StreamingMessage";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  agentId: string;
  lettaAgentId: string | null;
}

export function ChatPanel({ agentId, lettaAgentId }: ChatPanelProps) {
  const {
    messages,
    isStreaming,
    error,
    addUserMessage,
    startStreaming,
    appendStreamContent,
    appendStreamReasoning,
    addToolCall,
    resolveToolCall,
    addMemoryUpdate,
    finishStreaming,
    setError,
  } = useChatStore();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    addUserMessage(userMessage);

    // Use Letta streaming if available
    if (lettaAgentId) {
      await handleLettaStream(userMessage);
    } else {
      await handleLegacyChat(userMessage);
    }
  };

  const handleLettaStream = async (message: string) => {
    try {
      startStreaming();

      const response = await fetch(`/api/letta/agents/${lettaAgentId}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;

          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case "text":
                appendStreamContent(event.content);
                break;
              case "reasoning":
                appendStreamReasoning(event.content);
                break;
              case "tool_call":
                addToolCall({
                  id: event.id,
                  name: event.name,
                  arguments: event.arguments,
                });
                break;
              case "tool_result":
                resolveToolCall(event.id, event.result, event.status);
                break;
              case "memory_update":
                addMemoryUpdate(event.label, event.action);
                break;
              case "done":
                finishStreaming(event.messageId);
                break;
              case "error":
                setError(event.message);
                break;
            }
          } catch (e) {
            console.error("Failed to parse SSE event:", e);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  };

  const handleLegacyChat = async (message: string) => {
    try {
      startStreaming();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: agentId,
          stage: "mission", // Default stage for now
          message,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      appendStreamContent(data.reply);
      finishStreaming(crypto.randomUUID());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message) => (
            <StreamingMessage key={message.id} message={message} />
          ))}
          {isStreaming && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-900/20 p-3 text-sm text-red-400">
              Error: {error}
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Bar */}
      <div className="border-t border-zinc-800 bg-zinc-900 p-4">
        <div className="mx-auto max-w-3xl">
          <div className="relative flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={isStreaming}
              className="min-h-[60px] resize-none bg-zinc-800 text-zinc-100 placeholder:text-zinc-500"
              rows={3}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="h-[60px] w-[60px]"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
