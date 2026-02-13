import { describe, it, expect, beforeEach, vi } from "vitest";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useChatStore, type ChatMessage } from "@/stores/chat-store";
import {
  useMemoryStore,
  type MemoryBlock,
  type ArchivalPassage,
} from "@/stores/memory-store";

// ---------------------------------------------------------------------------
// Workspace Store
// ---------------------------------------------------------------------------
describe("useWorkspaceStore", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      activeAgentId: null,
      activeTeamId: null,
      activeLettaAgentId: null,
      activeTab: "chat",
      rightPanelOpen: false,
      rightPanelContent: null,
      sidebarCollapsed: false,
      commandPaletteOpen: false,
    });
  });

  describe("initial state", () => {
    it("has null IDs, chat tab, and all panels closed", () => {
      const state = useWorkspaceStore.getState();
      expect(state.activeAgentId).toBeNull();
      expect(state.activeTeamId).toBeNull();
      expect(state.activeLettaAgentId).toBeNull();
      expect(state.activeTab).toBe("chat");
      expect(state.rightPanelOpen).toBe(false);
      expect(state.rightPanelContent).toBeNull();
      expect(state.sidebarCollapsed).toBe(false);
      expect(state.commandPaletteOpen).toBe(false);
    });
  });

  describe("setActiveAgent", () => {
    it("sets activeAgentId and activeLettaAgentId", () => {
      useWorkspaceStore.getState().setActiveAgent("agent-1", "letta-1");
      const state = useWorkspaceStore.getState();
      expect(state.activeAgentId).toBe("agent-1");
      expect(state.activeLettaAgentId).toBe("letta-1");
    });

    it("defaults activeLettaAgentId to null when not provided", () => {
      useWorkspaceStore.getState().setActiveAgent("agent-2");
      const state = useWorkspaceStore.getState();
      expect(state.activeAgentId).toBe("agent-2");
      expect(state.activeLettaAgentId).toBeNull();
    });

    it("accepts explicit null for lettaId", () => {
      useWorkspaceStore.getState().setActiveAgent("agent-3", null);
      const state = useWorkspaceStore.getState();
      expect(state.activeAgentId).toBe("agent-3");
      expect(state.activeLettaAgentId).toBeNull();
    });

    it("overwrites a previously set agent", () => {
      const { setActiveAgent } = useWorkspaceStore.getState();
      setActiveAgent("agent-1", "letta-1");
      setActiveAgent("agent-2", "letta-2");
      const state = useWorkspaceStore.getState();
      expect(state.activeAgentId).toBe("agent-2");
      expect(state.activeLettaAgentId).toBe("letta-2");
    });
  });

  describe("setActiveTeam", () => {
    it("sets activeTeamId", () => {
      useWorkspaceStore.getState().setActiveTeam("team-1");
      expect(useWorkspaceStore.getState().activeTeamId).toBe("team-1");
    });

    it("accepts null to clear the team", () => {
      useWorkspaceStore.getState().setActiveTeam("team-1");
      useWorkspaceStore.getState().setActiveTeam(null);
      expect(useWorkspaceStore.getState().activeTeamId).toBeNull();
    });
  });

  describe("setActiveTab", () => {
    const tabs = ["chat", "memory", "tools", "artifacts", "settings"] as const;

    it.each(tabs)("sets activeTab to %s", (tab) => {
      useWorkspaceStore.getState().setActiveTab(tab);
      expect(useWorkspaceStore.getState().activeTab).toBe(tab);
    });
  });

  describe("toggleRightPanel", () => {
    it("opens the panel when closed", () => {
      useWorkspaceStore.getState().toggleRightPanel();
      expect(useWorkspaceStore.getState().rightPanelOpen).toBe(true);
    });

    it("closes the panel when open", () => {
      useWorkspaceStore.setState({ rightPanelOpen: true });
      useWorkspaceStore.getState().toggleRightPanel();
      expect(useWorkspaceStore.getState().rightPanelOpen).toBe(false);
    });

    it("toggles back and forth", () => {
      const { toggleRightPanel } = useWorkspaceStore.getState();
      toggleRightPanel();
      expect(useWorkspaceStore.getState().rightPanelOpen).toBe(true);
      useWorkspaceStore.getState().toggleRightPanel();
      expect(useWorkspaceStore.getState().rightPanelOpen).toBe(false);
    });
  });

  describe("setRightPanelContent", () => {
    it("sets content and opens the panel", () => {
      useWorkspaceStore.getState().setRightPanelContent("memory");
      const state = useWorkspaceStore.getState();
      expect(state.rightPanelContent).toBe("memory");
      expect(state.rightPanelOpen).toBe(true);
    });

    it("sets null content and closes the panel", () => {
      useWorkspaceStore.setState({ rightPanelOpen: true, rightPanelContent: "tools" });
      useWorkspaceStore.getState().setRightPanelContent(null);
      const state = useWorkspaceStore.getState();
      expect(state.rightPanelContent).toBeNull();
      expect(state.rightPanelOpen).toBe(false);
    });

    it.each(["memory", "tools", "artifacts"] as const)(
      "opens the panel for content %s",
      (content) => {
        useWorkspaceStore.getState().setRightPanelContent(content);
        const state = useWorkspaceStore.getState();
        expect(state.rightPanelContent).toBe(content);
        expect(state.rightPanelOpen).toBe(true);
      }
    );
  });

  describe("toggleSidebar", () => {
    it("collapses the sidebar when expanded", () => {
      useWorkspaceStore.getState().toggleSidebar();
      expect(useWorkspaceStore.getState().sidebarCollapsed).toBe(true);
    });

    it("expands the sidebar when collapsed", () => {
      useWorkspaceStore.setState({ sidebarCollapsed: true });
      useWorkspaceStore.getState().toggleSidebar();
      expect(useWorkspaceStore.getState().sidebarCollapsed).toBe(false);
    });
  });

  describe("toggleCommandPalette", () => {
    it("opens the command palette when closed", () => {
      useWorkspaceStore.getState().toggleCommandPalette();
      expect(useWorkspaceStore.getState().commandPaletteOpen).toBe(true);
    });

    it("closes the command palette when open", () => {
      useWorkspaceStore.setState({ commandPaletteOpen: true });
      useWorkspaceStore.getState().toggleCommandPalette();
      expect(useWorkspaceStore.getState().commandPaletteOpen).toBe(false);
    });
  });
});

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

  describe("addUserMessage", () => {
    it("appends a user message with correct role and content", () => {
      useChatStore.getState().addUserMessage("Hello");
      const { messages } = useChatStore.getState();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toBe("Hello");
      expect(messages[0].id).toBeDefined();
      expect(messages[0].timestamp).toBeDefined();
    });

    it("clears any existing error", () => {
      useChatStore.setState({ error: "previous error" });
      useChatStore.getState().addUserMessage("Hello");
      expect(useChatStore.getState().error).toBeNull();
    });

    it("appends multiple messages preserving order", () => {
      const { addUserMessage } = useChatStore.getState();
      addUserMessage("First");
      useChatStore.getState().addUserMessage("Second");
      const { messages } = useChatStore.getState();
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("First");
      expect(messages[1].content).toBe("Second");
    });

    it("generates unique IDs for each message", () => {
      useChatStore.getState().addUserMessage("A");
      useChatStore.getState().addUserMessage("B");
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

  describe("appendStreamContent", () => {
    it("appends text to partialContent", () => {
      useChatStore.getState().appendStreamContent("Hello");
      expect(useChatStore.getState().partialContent).toBe("Hello");
    });

    it("accumulates multiple appends", () => {
      useChatStore.getState().appendStreamContent("Hello ");
      useChatStore.getState().appendStreamContent("world");
      expect(useChatStore.getState().partialContent).toBe("Hello world");
    });

    it("appends to existing partialContent", () => {
      useChatStore.setState({ partialContent: "prefix-" });
      useChatStore.getState().appendStreamContent("suffix");
      expect(useChatStore.getState().partialContent).toBe("prefix-suffix");
    });
  });

  describe("appendStreamReasoning", () => {
    it("appends reasoning to the last streaming assistant message", () => {
      const streamingMsg: ChatMessage = {
        id: "msg-1",
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };
      useChatStore.setState({ messages: [streamingMsg] });
      useChatStore.getState().appendStreamReasoning("thinking...");
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
      useChatStore.getState().appendStreamReasoning("part1");
      useChatStore.getState().appendStreamReasoning("part2");
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
      useChatStore.getState().appendStreamReasoning("reasoning");
      expect(useChatStore.getState().messages[0].reasoning).toBeUndefined();
    });

    it("does nothing when messages array is empty", () => {
      useChatStore.getState().appendStreamReasoning("reasoning");
      expect(useChatStore.getState().messages).toHaveLength(0);
    });
  });

  describe("addToolCall", () => {
    it("appends a tool call to the last streaming assistant message with pending status", () => {
      const streamingMsg: ChatMessage = {
        id: "msg-1",
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };
      useChatStore.setState({ messages: [streamingMsg] });
      useChatStore.getState().addToolCall({
        id: "tc-1",
        name: "search",
        arguments: '{"q":"test"}',
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
      useChatStore.getState().addToolCall({ id: "tc-1", name: "a", arguments: "{}" });
      useChatStore.getState().addToolCall({ id: "tc-2", name: "b", arguments: "{}" });
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
      useChatStore.getState().addToolCall({ id: "tc-1", name: "a", arguments: "{}" });
      expect(useChatStore.getState().messages[0].toolCalls).toBeUndefined();
    });
  });

  describe("resolveToolCall", () => {
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
      useChatStore.getState().resolveToolCall("tc-1", "found it", "success");
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
      useChatStore.getState().resolveToolCall("tc-1", "timeout", "error");
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
      useChatStore.getState().resolveToolCall("non-existent", "data", "success");
      const toolCalls = useChatStore.getState().messages[0].toolCalls!;
      expect(toolCalls[0].status).toBe("pending");
      expect(toolCalls[0].result).toBeUndefined();
    });
  });

  describe("addMemoryUpdate", () => {
    it("appends a memory update to the last streaming assistant message", () => {
      const streamingMsg: ChatMessage = {
        id: "msg-1",
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };
      useChatStore.setState({ messages: [streamingMsg] });
      useChatStore.getState().addMemoryUpdate("persona", "updated persona block");
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
      useChatStore.getState().addMemoryUpdate("persona", "update 1");
      useChatStore.getState().addMemoryUpdate("human", "update 2");
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
      useChatStore.getState().addMemoryUpdate("persona", "update");
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
      activeBlockLabel: null,
      isEditing: false,
      editDraft: "",
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
    it("has empty blocks, archival, no editing, and not loading", () => {
      const state = useMemoryStore.getState();
      expect(state.blocks).toEqual([]);
      expect(state.archivalResults).toEqual([]);
      expect(state.activeBlockLabel).toBeNull();
      expect(state.isEditing).toBe(false);
      expect(state.editDraft).toBe("");
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

  describe("setActiveBlock", () => {
    it("sets the active block label", () => {
      useMemoryStore.getState().setActiveBlock("persona");
      expect(useMemoryStore.getState().activeBlockLabel).toBe("persona");
    });

    it("clears editing state when setting active block", () => {
      useMemoryStore.setState({ isEditing: true, editDraft: "draft text" });
      useMemoryStore.getState().setActiveBlock("human");
      const state = useMemoryStore.getState();
      expect(state.activeBlockLabel).toBe("human");
      expect(state.isEditing).toBe(false);
      expect(state.editDraft).toBe("");
    });

    it("accepts null to deselect block", () => {
      useMemoryStore.getState().setActiveBlock("persona");
      useMemoryStore.getState().setActiveBlock(null);
      expect(useMemoryStore.getState().activeBlockLabel).toBeNull();
    });
  });

  describe("startEditing", () => {
    it("sets isEditing to true and editDraft from the provided draft", () => {
      useMemoryStore.getState().startEditing("I am an AI assistant");
      const state = useMemoryStore.getState();
      expect(state.isEditing).toBe(true);
      expect(state.editDraft).toBe("I am an AI assistant");
    });

    it("works with empty string draft", () => {
      useMemoryStore.getState().startEditing("");
      const state = useMemoryStore.getState();
      expect(state.isEditing).toBe(true);
      expect(state.editDraft).toBe("");
    });
  });

  describe("updateDraft", () => {
    it("updates the editDraft text", () => {
      useMemoryStore.getState().startEditing("original");
      useMemoryStore.getState().updateDraft("modified");
      expect(useMemoryStore.getState().editDraft).toBe("modified");
    });

    it("can set draft to empty string", () => {
      useMemoryStore.setState({ editDraft: "some text" });
      useMemoryStore.getState().updateDraft("");
      expect(useMemoryStore.getState().editDraft).toBe("");
    });
  });

  describe("cancelEditing", () => {
    it("clears isEditing and editDraft", () => {
      useMemoryStore.setState({ isEditing: true, editDraft: "in progress" });
      useMemoryStore.getState().cancelEditing();
      const state = useMemoryStore.getState();
      expect(state.isEditing).toBe(false);
      expect(state.editDraft).toBe("");
    });

    it("is safe to call when not editing", () => {
      useMemoryStore.getState().cancelEditing();
      const state = useMemoryStore.getState();
      expect(state.isEditing).toBe(false);
      expect(state.editDraft).toBe("");
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

  describe("editing workflow integration", () => {
    it("supports full edit lifecycle: setActiveBlock -> startEditing -> updateDraft -> cancelEditing", () => {
      useMemoryStore.getState().setBlocks(sampleBlocks);

      // Select a block
      useMemoryStore.getState().setActiveBlock("persona");
      expect(useMemoryStore.getState().activeBlockLabel).toBe("persona");

      // Start editing with the block value
      useMemoryStore.getState().startEditing("I am an AI assistant");
      expect(useMemoryStore.getState().isEditing).toBe(true);
      expect(useMemoryStore.getState().editDraft).toBe("I am an AI assistant");

      // Modify the draft
      useMemoryStore.getState().updateDraft("I am a helpful AI");
      expect(useMemoryStore.getState().editDraft).toBe("I am a helpful AI");

      // Cancel editing
      useMemoryStore.getState().cancelEditing();
      expect(useMemoryStore.getState().isEditing).toBe(false);
      expect(useMemoryStore.getState().editDraft).toBe("");
      // Active block is still selected
      expect(useMemoryStore.getState().activeBlockLabel).toBe("persona");
    });

    it("switching active block clears edit state", () => {
      useMemoryStore.getState().setBlocks(sampleBlocks);
      useMemoryStore.getState().setActiveBlock("persona");
      useMemoryStore.getState().startEditing("I am an AI assistant");

      // Switch to different block
      useMemoryStore.getState().setActiveBlock("human");
      const state = useMemoryStore.getState();
      expect(state.activeBlockLabel).toBe("human");
      expect(state.isEditing).toBe(false);
      expect(state.editDraft).toBe("");
    });
  });
});
