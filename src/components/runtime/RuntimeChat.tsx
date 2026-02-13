"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, RotateCcw, Wrench } from "lucide-react";

interface AgentInfo {
  name: string;
  emoji?: string;
  greeting: string;
  description?: string;
  vibe?: string;
  tone?: string;
}

interface RuntimeMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
}

interface SessionInfo {
  token: string;
  turnCount: number;
  status: string;
  maxTurns: number;
}

interface RuntimeChatProps {
  slug: string;
}

export function RuntimeChat({ slug }: RuntimeChatProps) {
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [messages, setMessages] = useState<RuntimeMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [guardrailNotice, setGuardrailNotice] = useState<string | null>(null);
  const [isUsingTools, setIsUsingTools] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch agent info on mount
  useEffect(() => {
    async function fetchAgentInfo() {
      try {
        const res = await fetch(`/api/runtime/${slug}`);
        if (!res.ok) {
          setError(res.status === 404 ? "Agent not found or not deployed" : "Failed to load agent");
          return;
        }
        const data = await res.json();
        setAgentInfo(data.agent);
      } catch {
        setError("Failed to connect to the server");
      } finally {
        setIsInitialLoading(false);
      }
    }
    fetchAgentInfo();
  }, [slug]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector("[data-slot='scroll-area-viewport']");
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  // Focus input
  useEffect(() => {
    if (!isInitialLoading && agentInfo) {
      inputRef.current?.focus();
    }
  }, [isInitialLoading, agentInfo]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: RuntimeMessage = {
      id: `local_${Date.now()}`,
      role: "user",
      content: text.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setGuardrailNotice(null);

    try {
      const res = await fetch(`/api/runtime/${slug}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          sessionToken: session?.token,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }

      const data = await res.json();
      const toolsUsed = data.toolsUsed as string[] | undefined;
      if (toolsUsed && toolsUsed.length > 0) {
        setIsUsingTools(true);
      }
      setMessages((prev) => [...prev, {
        id: data.message.id,
        role: "assistant",
        content: data.message.content,
        toolsUsed: toolsUsed,
      }]);
      setIsUsingTools(false);
      setSession(data.session);
      if (data.guardrailNotice) {
        setGuardrailNotice(data.guardrailNotice);
      }
    } catch {
      setMessages((prev) => [...prev, {
        id: `error_${Date.now()}`,
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, slug, session?.token]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const startNewConversation = () => {
    setMessages([]);
    setSession(null);
    setGuardrailNotice(null);
    inputRef.current?.focus();
  };

  const isSessionEnded = session?.status === "ended" || session?.status === "escalated";

  // Loading state
  if (isInitialLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error || !agentInfo) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">{error || "Agent unavailable"}</p>
          <p className="text-sm text-muted-foreground mt-2">This agent may not be deployed yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          {agentInfo.emoji && <span className="text-xl">{agentInfo.emoji}</span>}
          <span className="font-semibold">{agentInfo.name}</span>
        </div>
        {session && (
          <span className="text-xs text-muted-foreground">
            {session.turnCount} of {session.maxTurns} turns
          </span>
        )}
      </header>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="mx-auto max-w-2xl flex flex-col gap-4">
          {/* Greeting */}
          {messages.length === 0 && (
            <div className="flex justify-start">
              <div className="chat-bubble-assistant">
                <p className="text-sm">{agentInfo.greeting}</p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div>
                <div className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant"}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <Wrench className="h-3 w-3" />
                    <span>Used {msg.toolsUsed.length} tool{msg.toolsUsed.length !== 1 ? "s" : ""}: {msg.toolsUsed.join(", ")}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="chat-bubble-assistant">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {isUsingTools ? (
                    <>
                      <Wrench className="h-4 w-4 animate-pulse" />
                      <span>Using tools...</span>
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{agentInfo.name} is thinking...</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Guardrail notice */}
          {guardrailNotice && (
            <div className="text-center text-xs text-muted-foreground py-2">
              {guardrailNotice}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="mx-auto max-w-2xl">
          {isSessionEnded ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {session?.status === "escalated"
                  ? "This conversation has been escalated to a human."
                  : "This conversation has ended."}
              </p>
              <Button variant="outline" size="sm" onClick={startNewConversation}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Start new conversation
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Message ${agentInfo.name}...`}
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
          <p className="text-center text-xs text-muted-foreground mt-3">
            Powered by Agent OS
          </p>
        </div>
      </div>
    </div>
  );
}
