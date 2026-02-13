import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
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
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  startStreaming: () => void;
  updateStreamingMessage: (update: {
    content?: string;
    reasoning?: string;
    toolCall?: { id: string; name: string; arguments: string };
    toolResult?: { id: string; result: string; status: 'success' | 'error' };
    memoryUpdate?: { label: string; action: string };
  }) => void;
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
  addMessage: (role, content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          role,
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

  updateStreamingMessage: (update) =>
    set((state) => {
      if (update.content !== undefined) {
        return { partialContent: state.partialContent + update.content };
      }

      const messages = [...state.messages];
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant' || !lastMessage.isStreaming) {
        return { messages };
      }

      if (update.reasoning !== undefined) {
        lastMessage.reasoning = (lastMessage.reasoning || '') + update.reasoning;
      }
      if (update.toolCall) {
        lastMessage.toolCalls = [
          ...(lastMessage.toolCalls || []),
          { ...update.toolCall, status: 'pending' as const },
        ];
      }
      if (update.toolResult) {
        const tc = (lastMessage.toolCalls || []).find((t) => t.id === update.toolResult!.id);
        if (tc) {
          tc.result = update.toolResult.result;
          tc.status = update.toolResult.status;
        }
      }
      if (update.memoryUpdate) {
        lastMessage.memoryUpdates = [
          ...(lastMessage.memoryUpdates || []),
          update.memoryUpdate,
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
