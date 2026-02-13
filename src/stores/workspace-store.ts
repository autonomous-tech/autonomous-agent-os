import { create } from 'zustand';

interface WorkspaceState {
  // Active agent/team context
  activeAgentId: string | null;
  activeTeamId: string | null;
  activeLettaAgentId: string | null;

  // Panel state
  activeTab: 'chat' | 'memory' | 'tools' | 'artifacts' | 'settings';
  rightPanelOpen: boolean;
  rightPanelContent: 'memory' | 'tools' | 'artifacts' | null;

  // Navigation
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;

  // Actions
  setActiveAgent: (id: string, lettaId?: string | null) => void;
  setActiveTeam: (id: string | null) => void;
  setActiveTab: (tab: WorkspaceState['activeTab']) => void;
  toggleRightPanel: () => void;
  setRightPanelContent: (content: WorkspaceState['rightPanelContent']) => void;
  toggleSidebar: () => void;
  toggleCommandPalette: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  // Initial state
  activeAgentId: null,
  activeTeamId: null,
  activeLettaAgentId: null,

  activeTab: 'chat',
  rightPanelOpen: false,
  rightPanelContent: null,

  sidebarCollapsed: false,
  commandPaletteOpen: false,

  // Actions
  setActiveAgent: (id, lettaId = null) =>
    set({ activeAgentId: id, activeLettaAgentId: lettaId }),

  setActiveTeam: (id) =>
    set({ activeTeamId: id }),

  setActiveTab: (tab) =>
    set({ activeTab: tab }),

  toggleRightPanel: () =>
    set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

  setRightPanelContent: (content) =>
    set({ rightPanelContent: content, rightPanelOpen: content !== null }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  toggleCommandPalette: () =>
    set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
}));
