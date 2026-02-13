import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  // Streaming-specific
  isStreaming?: boolean;
  reasoning?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
    result?: string;
    status?: 'pending' | 'success' | 'error';
  }>;
  memoryUpdates?: Array<{
    label: string;
    action: string;
  }>;
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  partialContent: string;
  error: string | null;

  // Actions
  addUserMessage: (content: string) => void;
  startStreaming: () => void;
  appendStreamContent: (content: string) => void;
  appendStreamReasoning: (content: string) => void;
  addToolCall: (toolCall: { id: string; name: string; arguments: string }) => void;
  resolveToolCall: (id: string, result: string, status: 'success' | 'error') => void;
  addMemoryUpdate: (label: string, action: string) => void;
  finishStreaming: (messageId: string) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
  loadMessages: (messages: ChatMessage[]) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  // Initial state
  messages: [],
  isStreaming: false,
  partialContent: '',
  error: null,

  // Actions
  addUserMessage: (content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content,
          timestamp: new Date().toISOString(),
        },
      ],
      error: null,
    })),

  startStreaming: () =>
    set({
      isStreaming: true,
      partialContent: '',
      error: null,
    }),

  appendStreamContent: (content) =>
    set((state) => ({
      partialContent: state.partialContent + content,
    })),

  appendStreamReasoning: (content) =>
    set((state) => {
      const messages = [...state.messages];
      const lastMessage = messages[messages.length - 1];

      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
        lastMessage.reasoning = (lastMessage.reasoning || '') + content;
      }

      return { messages };
    }),

  addToolCall: (toolCall) =>
    set((state) => {
      const messages = [...state.messages];
      const lastMessage = messages[messages.length - 1];

      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
        lastMessage.toolCalls = [
          ...(lastMessage.toolCalls || []),
          { ...toolCall, status: 'pending' as const },
        ];
      }

      return { messages };
    }),

  resolveToolCall: (id, result, status) =>
    set((state) => {
      const messages = [...state.messages];
      const lastMessage = messages[messages.length - 1];

      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
        const toolCalls = lastMessage.toolCalls || [];
        const toolCall = toolCalls.find((tc) => tc.id === id);
        if (toolCall) {
          toolCall.result = result;
          toolCall.status = status;
        }
      }

      return { messages };
    }),

  addMemoryUpdate: (label, action) =>
    set((state) => {
      const messages = [...state.messages];
      const lastMessage = messages[messages.length - 1];

      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
        lastMessage.memoryUpdates = [
          ...(lastMessage.memoryUpdates || []),
          { label, action },
        ];
      }

      return { messages };
    }),

  finishStreaming: (messageId) =>
    set((state) => {
      const messages = [...state.messages];
      const lastMessage = messages[messages.length - 1];

      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
        lastMessage.isStreaming = false;
        lastMessage.content = state.partialContent;
      } else {
        // Add new assistant message if one doesn't exist
        messages.push({
          id: messageId,
          role: 'assistant',
          content: state.partialContent,
          timestamp: new Date().toISOString(),
          isStreaming: false,
        });
      }

      return {
        messages,
        isStreaming: false,
        partialContent: '',
      };
    }),

  setError: (error) =>
    set({ error, isStreaming: false }),

  clearMessages: () =>
    set({ messages: [], error: null, partialContent: '', isStreaming: false }),

  loadMessages: (messages) =>
    set({ messages, error: null }),
}));
