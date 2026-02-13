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
  archivalQuery: string;
  isLoading: boolean;

  // Actions
  setBlocks: (blocks: MemoryBlock[]) => void;
  setArchivalResults: (results: ArchivalPassage[]) => void;
  setArchivalQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useMemoryStore = create<MemoryState>((set) => ({
  // Initial state
  blocks: [],
  archivalResults: [],
  archivalQuery: '',
  isLoading: false,

  // Actions
  setBlocks: (blocks) =>
    set({ blocks }),

  setArchivalResults: (results) =>
    set({ archivalResults: results }),

  setArchivalQuery: (query) =>
    set({ archivalQuery: query }),

  setLoading: (loading) =>
    set({ isLoading: loading }),
}));
