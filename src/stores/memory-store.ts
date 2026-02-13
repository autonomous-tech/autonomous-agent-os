import { create } from 'zustand';

export interface MemoryBlock {
  id: string;
  label: string;
  value: string;
  limit: number;
  description?: string;
  readOnly?: boolean;
}

export interface ArchivalPassage {
  id: string;
  text: string;
  tags?: string[];
  createdAt?: string;
}

interface MemoryState {
  blocks: MemoryBlock[];
  archivalResults: ArchivalPassage[];
  activeBlockLabel: string | null;
  isEditing: boolean;
  editDraft: string;
  archivalQuery: string;
  isLoading: boolean;

  // Actions
  setBlocks: (blocks: MemoryBlock[]) => void;
  setActiveBlock: (label: string | null) => void;
  startEditing: (draft: string) => void;
  updateDraft: (draft: string) => void;
  cancelEditing: () => void;
  setArchivalResults: (results: ArchivalPassage[]) => void;
  setArchivalQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useMemoryStore = create<MemoryState>((set) => ({
  // Initial state
  blocks: [],
  archivalResults: [],
  activeBlockLabel: null,
  isEditing: false,
  editDraft: '',
  archivalQuery: '',
  isLoading: false,

  // Actions
  setBlocks: (blocks) =>
    set({ blocks }),

  setActiveBlock: (label) =>
    set({ activeBlockLabel: label, isEditing: false, editDraft: '' }),

  startEditing: (draft) =>
    set({ isEditing: true, editDraft: draft }),

  updateDraft: (draft) =>
    set({ editDraft: draft }),

  cancelEditing: () =>
    set({ isEditing: false, editDraft: '' }),

  setArchivalResults: (results) =>
    set({ archivalResults: results }),

  setArchivalQuery: (query) =>
    set({ archivalQuery: query }),

  setLoading: (loading) =>
    set({ isLoading: loading }),
}));
