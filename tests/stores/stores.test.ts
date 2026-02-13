import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore, type ChatMessage } from "@/stores/chat-store";
import {
  useMemoryStore,
  type MemoryBlock,
  type ArchivalPassage,
} from "@/stores/memory-store";

// ---------------------------------------------------------------------------
// Chat Store
// ---------------------------------------------------------------------------
describe("useChatStore", () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      isStreaming: false,
      partialContent: "",
      error: null,
    });
  });

  describe("initial state", () => {
    it("has empty messages, not streaming, empty partial content, and no error", () => {
      const state = useChatStore.getState();
      expect(state.messages).toEqual([]);
      expect(state.isStreaming).toBe(false);
      expect(state.partialContent).toBe("");
      expect(state.error).toBeNull();
    });
  });

  describe("addMessage", () => {
    it("appends a user message with correct role and content", () => {
      useChatStore.getState().addMessage("user", "Hello");
      const { messages } = useChatStore.getState();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toBe("Hello");
      expect(messages[0].id).toBeDefined();
      expect(messages[0].timestamp).toBeDefined();
    });

    it("clears any existing error", () => {
      useChatStore.setState({ error: "previous error" });
      useChatStore.getState().addMessage("user", "Hello");
      expect(useChatStore.getState().error).toBeNull();
    });

    it("appends multiple messages preserving order", () => {
      const { addMessage } = useChatStore.getState();
      addMessage("user", "First");
      useChatStore.getState().addMessage("user", "Second");
      const { messages } = useChatStore.getState();
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("First");
      expect(messages[1].content).toBe("Second");
    });

    it("generates unique IDs for each message", () => {
      useChatStore.getState().addMessage("user", "A");
      useChatStore.getState().addMessage("user", "B");
      const { messages } = useChatStore.getState();
      expect(messages[0].id).not.toBe(messages[1].id);
    });
  });

  describe("startStreaming", () => {
    it("sets isStreaming to true, clears partialContent and error", () => {
      useChatStore.setState({ partialContent: "leftover", error: "old error" });
      useChatStore.getState().startStreaming();
      const state = useChatStore.getState();
      expect(state.isStreaming).toBe(true);
      expect(state.partialContent).toBe("");
      expect(state.error).toBeNull();
    });
  });

  describe("updateStreamingMessage (content)", () => {
    it("appends text to partialContent", () => {
      useChatStore.getState().updateStreamingMessage({ content: "Hello" });
      expect(useChatStore.getState().partialContent).toBe("Hello");
    });

    it("accumulates multiple appends", () => {
      useChatStore.getState().updateStreamingMessage({ content: "Hello " });
      useChatStore.getState().updateStreamingMessage({ content: "world" });
      expect(useChatStore.getState().partialContent).toBe("Hello world");
    });

    it("appends to existing partialContent", () => {
      useChatStore.setState({ partialContent: "prefix-" });
      useChatStore.getState().updateStreamingMessage({ content: "suffix" });
      expect(useChatStore.getState().partialContent).toBe("prefix-suffix");
    });
  });

  describe("updateStreamingMessage (reasoning)", () => {
    it("appends reasoning to the last streaming assistant message", () => {
      const streamingMsg: ChatMessage = {
        id: "msg-1",
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };
      useChatStore.setState({ messages: [streamingMsg] });
      useChatStore.getState().updateStreamingMessage({ reasoning: "thinking..." });
      const { messages } = useChatStore.getState();
      expect(messages[0].reasoning).toBe("thinking...");
    });

    it("accumulates multiple reasoning appends", () => {
      const streamingMsg: ChatMessage = {
        id: "msg-1",
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };
      useChatStore.setState({ messages: [streamingMsg] });
      useChatStore.getState().updateStreamingMessage({ reasoning: "part1" });
      useChatStore.getState().updateStreamingMessage({ reasoning: "part2" });
      expect(useChatStore.getState().messages[0].reasoning).toBe("part1part2");
    });

    it("does nothing when last message is not a streaming assistant", () => {
      const userMsg: ChatMessage = {
        id: "msg-1",
        role: "user",
        content: "Hi",
        timestamp: new Date().toISOString(),
      };
      useChatStore.setState({ messages: [userMsg] });
      useChatStore.getState().updateStreamingMessage({ reasoning: "reasoning" });
      expect(useChatStore.getState().messages[0].reasoning).toBeUndefined();
    });

    it("does nothing when messages array is empty", () => {
      useChatStore.getState().updateStreamingMessage({ reasoning: "reasoning" });
      expect(useChatStore.getState().messages).toHaveLength(0);
    });
  });

  describe("updateStreamingMessage (toolCall)", () => {
    it("appends a tool call to the last streaming assistant message with pending status", () => {
      const streamingMsg: ChatMessage = {
        id: "msg-1",
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };
      useChatStore.setState({ messages: [streamingMsg] });
      useChatStore.getState().updateStreamingMessage({
        toolCall: { id: "tc-1", name: "search", arguments: '{"q":"test"}' },
      });
      const { messages } = useChatStore.getState();
      expect(messages[0].toolCalls).toHaveLength(1);
      expect(messages[0].toolCalls![0]).toEqual({
        id: "tc-1",
        name: "search",
        arguments: '{"q":"test"}',
        status: "pending",
      });
    });

    it("appends multiple tool calls", () => {
      const streamingMsg: ChatMessage = {
        id: "msg-1",
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };
      useChatStore.setState({ messages: [streamingMsg] });
      useChatStore.getState().updateStreamingMessage({
        toolCall: { id: "tc-1", name: "a", arguments: "{}" },
      });
      useChatStore.getState().updateStreamingMessage({
        toolCall: { id: "tc-2", name: "b", arguments: "{}" },
      });
      expect(useChatStore.getState().messages[0].toolCalls).toHaveLength(2);
    });

    it("does nothing when last message is not a streaming assistant", () => {
      const userMsg: ChatMessage = {
        id: "msg-1",
        role: "user",
        content: "Hi",
        timestamp: new Date().toISOString(),
      };
      useChatStore.setState({ messages: [userMsg] });
      useChatStore.getState().updateStreamingMessage({
        toolCall: { id: "tc-1", name: "a", arguments: "{}" },
      });
      expect(useChatStore.getState().messages[0].toolCalls).toBeUndefined();
    });
  });

  describe("updateStreamingMessage (toolResult)", () => {
    it("updates a specific tool call with result and status", () => {
      const streamingMsg: ChatMessage = {
        id: "msg-1",
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isStreaming: true,
        toolCalls: [
          { id: "tc-1", name: "search", arguments: "{}", status: "pending" },
          { id: "tc-2", name: "fetch", arguments: "{}", status: "pending" },
        ],
      };
      useChatStore.setState({ messages: [streamingMsg] });
      useChatStore.getState().updateStreamingMessage({
        toolResult: { id: "tc-1", result: "found it", status: "success" },
      });
      const toolCalls = useChatStore.getState().messages[0].toolCalls!;
      expect(toolCalls[0].result).toBe("found it");
      expect(toolCalls[0].status).toBe("success");
      // The other tool call remains pending
      expect(toolCalls[1].status).toBe("pending");
      expect(toolCalls[1].result).toBeUndefined();
    });

    it("can resolve with error status", () => {
      const streamingMsg: ChatMessage = {
        id: "msg-1",
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isStreaming: true,
        toolCalls: [
          { id: "tc-1", name: "search", arguments: "{}", status: "pending" },
        ],
      };
      useChatStore.setState({ messages: [streamingMsg] });
      useChatStore.getState().updateStreamingMessage({
        toolResult: { id: "tc-1", result: "timeout", status: "error" },
      });
      const toolCalls = useChatStore.getState().messages[0].toolCalls!;
      expect(toolCalls[0].result).toBe("timeout");
      expect(toolCalls[0].status).toBe("error");
    });

    it("does nothing for a non-existent tool call ID", () => {
      const streamingMsg: ChatMessage = {
        id: "msg-1",
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isStreaming: true,
        toolCalls: [
          { id: "tc-1", name: "search", arguments: "{}", status: "pending" },
        ],
      };
      useChatStore.setState({ messages: [streamingMsg] });
      useChatStore.getState().updateStreamingMessage({
        toolResult: { id: "non-existent", result: "data", status: "success" },
      });
      const toolCalls = useChatStore.getState().messages[0].toolCalls!;
      expect(toolCalls[0].status).toBe("pending");
      expect(toolCalls[0].result).toBeUndefined();
    });
  });

  describe("updateStreamingMessage (memoryUpdate)", () => {
    it("appends a memory update to the last streaming assistant message", () => {
      const streamingMsg: ChatMessage = {
        id: "msg-1",
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };
      useChatStore.setState({ messages: [streamingMsg] });
      useChatStore.getState().updateStreamingMessage({
        memoryUpdate: { label: "persona", action: "updated persona block" },
      });
      const { messages } = useChatStore.getState();
      expect(messages[0].memoryUpdates).toHaveLength(1);
      expect(messages[0].memoryUpdates![0]).toEqual({
        label: "persona",
        action: "updated persona block",
      });
    });

    it("appends multiple memory updates", () => {
      const streamingMsg: ChatMessage = {
        id: "msg-1",
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };
      useChatStore.setState({ messages: [streamingMsg] });
      useChatStore.getState().updateStreamingMessage({
        memoryUpdate: { label: "persona", action: "update 1" },
      });
      useChatStore.getState().updateStreamingMessage({
        memoryUpdate: { label: "human", action: "update 2" },
      });
      expect(useChatStore.getState().messages[0].memoryUpdates).toHaveLength(2);
    });

    it("does nothing when last message is not a streaming assistant", () => {
      const userMsg: ChatMessage = {
        id: "msg-1",
        role: "user",
        content: "Hi",
        timestamp: new Date().toISOString(),
      };
      useChatStore.setState({ messages: [userMsg] });
      useChatStore.getState().updateStreamingMessage({
        memoryUpdate: { label: "persona", action: "update" },
      });
      expect(useChatStore.getState().messages[0].memoryUpdates).toBeUndefined();
    });
  });

  describe("finishStreaming", () => {
    it("finalizes a streaming assistant message with partialContent", () => {
      const streamingMsg: ChatMessage = {
        id: "msg-1",
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };
      useChatStore.setState({
        messages: [streamingMsg],
        isStreaming: true,
        partialContent: "Final answer",
      });
      useChatStore.getState().finishStreaming("msg-1");
      const state = useChatStore.getState();
      expect(state.messages[0].content).toBe("Final answer");
      expect(state.messages[0].isStreaming).toBe(false);
      expect(state.isStreaming).toBe(false);
      expect(state.partialContent).toBe("");
    });

    it("creates a new assistant message when no streaming message exists", () => {
      const userMsg: ChatMessage = {
        id: "msg-1",
        role: "user",
        content: "Hi",
        timestamp: new Date().toISOString(),
      };
      useChatStore.setState({
        messages: [userMsg],
        isStreaming: true,
        partialContent: "Response text",
      });
      useChatStore.getState().finishStreaming("msg-2");
      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(2);
      expect(state.messages[1].id).toBe("msg-2");
      expect(state.messages[1].role).toBe("assistant");
      expect(state.messages[1].content).toBe("Response text");
      expect(state.messages[1].isStreaming).toBe(false);
    });

    it("creates a new message when messages array is empty", () => {
      useChatStore.setState({ isStreaming: true, partialContent: "solo" });
      useChatStore.getState().finishStreaming("msg-solo");
      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].id).toBe("msg-solo");
      expect(state.messages[0].content).toBe("solo");
    });
  });

  describe("setError", () => {
    it("sets an error and stops streaming", () => {
      useChatStore.setState({ isStreaming: true });
      useChatStore.getState().setError("Something went wrong");
      const state = useChatStore.getState();
      expect(state.error).toBe("Something went wrong");
      expect(state.isStreaming).toBe(false);
    });

    it("clears error when set to null", () => {
      useChatStore.setState({ error: "old error" });
      useChatStore.getState().setError(null);
      expect(useChatStore.getState().error).toBeNull();
    });
  });

  describe("clearMessages", () => {
    it("resets messages, error, partialContent, and isStreaming", () => {
      useChatStore.setState({
        messages: [
          { id: "1", role: "user", content: "hi", timestamp: "t" },
        ],
        error: "err",
        partialContent: "partial",
        isStreaming: true,
      });
      useChatStore.getState().clearMessages();
      const state = useChatStore.getState();
      expect(state.messages).toEqual([]);
      expect(state.error).toBeNull();
      expect(state.partialContent).toBe("");
      expect(state.isStreaming).toBe(false);
    });

    it("is idempotent on already empty state", () => {
      useChatStore.getState().clearMessages();
      const state = useChatStore.getState();
      expect(state.messages).toEqual([]);
      expect(state.error).toBeNull();
    });
  });

  describe("loadMessages", () => {
    it("replaces messages and clears error", () => {
      useChatStore.setState({ error: "old error" });
      const loaded: ChatMessage[] = [
        { id: "m1", role: "user", content: "hello", timestamp: "t1" },
        { id: "m2", role: "assistant", content: "hi", timestamp: "t2" },
      ];
      useChatStore.getState().loadMessages(loaded);
      const state = useChatStore.getState();
      expect(state.messages).toEqual(loaded);
      expect(state.error).toBeNull();
    });

    it("can load an empty array", () => {
      useChatStore.setState({
        messages: [{ id: "1", role: "user", content: "x", timestamp: "t" }],
      });
      useChatStore.getState().loadMessages([]);
      expect(useChatStore.getState().messages).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Memory Store
// ---------------------------------------------------------------------------
describe("useMemoryStore", () => {
  beforeEach(() => {
    useMemoryStore.setState({
      blocks: [],
      archivalResults: [],
      archivalQuery: "",
      isLoading: false,
    });
  });

  const sampleBlocks: MemoryBlock[] = [
    { id: "b1", label: "persona", value: "I am an AI assistant", limit: 2000 },
    { id: "b2", label: "human", value: "User info", limit: 2000, readOnly: true },
    {
      id: "b3",
      label: "system",
      value: "System notes",
      limit: 1000,
      description: "Core memory",
    },
  ];

  const sampleArchival: ArchivalPassage[] = [
    { id: "a1", text: "First passage", tags: ["intro"], createdAt: "2024-01-01" },
    { id: "a2", text: "Second passage" },
  ];

  describe("initial state", () => {
    it("has empty blocks, archival, and not loading", () => {
      const state = useMemoryStore.getState();
      expect(state.blocks).toEqual([]);
      expect(state.archivalResults).toEqual([]);
      expect(state.archivalQuery).toBe("");
      expect(state.isLoading).toBe(false);
    });
  });

  describe("setBlocks", () => {
    it("sets blocks array", () => {
      useMemoryStore.getState().setBlocks(sampleBlocks);
      expect(useMemoryStore.getState().blocks).toEqual(sampleBlocks);
    });

    it("replaces existing blocks", () => {
      useMemoryStore.getState().setBlocks(sampleBlocks);
      const newBlocks: MemoryBlock[] = [
        { id: "b4", label: "new", value: "new block", limit: 500 },
      ];
      useMemoryStore.getState().setBlocks(newBlocks);
      expect(useMemoryStore.getState().blocks).toEqual(newBlocks);
    });

    it("can set an empty array", () => {
      useMemoryStore.getState().setBlocks(sampleBlocks);
      useMemoryStore.getState().setBlocks([]);
      expect(useMemoryStore.getState().blocks).toEqual([]);
    });
  });

  describe("setArchivalResults", () => {
    it("sets archival results array", () => {
      useMemoryStore.getState().setArchivalResults(sampleArchival);
      expect(useMemoryStore.getState().archivalResults).toEqual(sampleArchival);
    });

    it("replaces existing archival results", () => {
      useMemoryStore.getState().setArchivalResults(sampleArchival);
      const newResults: ArchivalPassage[] = [{ id: "a3", text: "New passage" }];
      useMemoryStore.getState().setArchivalResults(newResults);
      expect(useMemoryStore.getState().archivalResults).toEqual(newResults);
    });

    it("can set empty archival results", () => {
      useMemoryStore.getState().setArchivalResults(sampleArchival);
      useMemoryStore.getState().setArchivalResults([]);
      expect(useMemoryStore.getState().archivalResults).toEqual([]);
    });
  });

  describe("setArchivalQuery", () => {
    it("sets the archival query string", () => {
      useMemoryStore.getState().setArchivalQuery("search term");
      expect(useMemoryStore.getState().archivalQuery).toBe("search term");
    });

    it("can set empty query", () => {
      useMemoryStore.setState({ archivalQuery: "previous" });
      useMemoryStore.getState().setArchivalQuery("");
      expect(useMemoryStore.getState().archivalQuery).toBe("");
    });
  });

  describe("setLoading", () => {
    it("sets isLoading to true", () => {
      useMemoryStore.getState().setLoading(true);
      expect(useMemoryStore.getState().isLoading).toBe(true);
    });

    it("sets isLoading to false", () => {
      useMemoryStore.setState({ isLoading: true });
      useMemoryStore.getState().setLoading(false);
      expect(useMemoryStore.getState().isLoading).toBe(false);
    });
  });

});
