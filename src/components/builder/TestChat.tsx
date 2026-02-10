"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, X } from "lucide-react";
import type { AgentConfig } from "@/lib/types";

interface TestChatProps {
  projectId: string;
  config: AgentConfig;
  onExit: () => void;
}

interface TestMessage {
  role: "user" | "agent";
  content: string;
}

export function TestChat({ projectId, config, onExit }: TestChatProps) {
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const agentName = config.identity?.name || "Agent";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector("[data-slot='scroll-area-viewport']");
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: TestMessage = { role: "user", content: text.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          message: text.trim(),
          conversationHistory: updatedMessages,
        }),
      });

      if (!res.ok) throw new Error("Test request failed");

      const data = await res.json();

      setMessages([
        ...updatedMessages,
        { role: "agent", content: data.content },
      ]);
    } catch (error) {
      console.error("Test error:", error);
      setMessages([
        ...updatedMessages,
        {
          role: "agent",
          content: "Sorry, I encountered an error during testing. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Testing mode banner */}
      <div className="flex items-center justify-between border-b bg-amber-900/20 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-amber-500/50 text-amber-400 text-xs"
          >
            Testing Mode
          </Badge>
          <span className="text-sm text-muted-foreground">
            Chatting with {agentName}
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onExit}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="flex flex-col gap-4">
          {/* Initial greeting */}
          {messages.length === 0 && (
            <div className="flex justify-start">
              <div className="chat-bubble-assistant">
                <p className="text-sm">
                  {config.identity?.greeting ||
                    `Hi! I'm ${agentName}. How can I help you today?`}
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={
                msg.role === "user"
                  ? "flex justify-end"
                  : "flex justify-start"
              }
            >
              <div
                className={
                  msg.role === "user"
                    ? "chat-bubble-user"
                    : "chat-bubble-assistant"
                }
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="chat-bubble-assistant">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{agentName} is thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${agentName}...`}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
