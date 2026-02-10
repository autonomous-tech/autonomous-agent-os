"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2 } from "lucide-react";
import type { ChatMessage, StageName, ChatResponse } from "@/lib/types";

interface ChatPaneProps {
  projectId: string;
  stage: StageName;
  messages: ChatMessage[];
  onMessagesUpdate: (messages: ChatMessage[]) => void;
  onConfigUpdate: (updates: Array<{ field: string; value: unknown }>, stage: StageName) => void;
  onStageStatusUpdate: (stage: StageName, status: "draft" | "approved") => void;
}

export function ChatPane({
  projectId,
  stage,
  messages,
  onMessagesUpdate,
  onConfigUpdate,
  onStageStatusUpdate,
}: ChatPaneProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector("[data-slot='scroll-area-viewport']");
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  // Focus input on stage change
  useEffect(() => {
    inputRef.current?.focus();
  }, [stage]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: text.trim() };
    const updatedMessages = [...messages, userMessage];
    onMessagesUpdate(updatedMessages);
    setInput("");
    setQuickReplies([]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          stage,
          message: text.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error("Chat request failed");
      }

      const data: ChatResponse = await res.json();

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.reply,
      };

      onMessagesUpdate([...updatedMessages, assistantMessage]);

      // Apply preview updates
      if (data.previewUpdates && data.previewUpdates.length > 0) {
        onConfigUpdate(data.previewUpdates, stage);
      }

      // Update stage status
      if (data.stageStatus) {
        onStageStatusUpdate(stage, data.stageStatus as "draft" | "approved");
      }

      // Set quick replies
      if (data.quickReplies && data.quickReplies.length > 0) {
        setQuickReplies(data.quickReplies);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content:
          "Sorry, I encountered an error. Please try again.",
      };
      onMessagesUpdate([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickReply = (reply: string) => {
    sendMessage(reply);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Start a conversation to configure this stage.
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
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick replies */}
      {quickReplies.length > 0 && !isLoading && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {quickReplies.map((reply, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => handleQuickReply(reply)}
              className="text-xs"
            >
              {reply}
            </Button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
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
