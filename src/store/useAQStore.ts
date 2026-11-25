// ─────────────────────────────────────────────────────────────────────────────
// AirGuard AI — Zustand Store
// Global state management for multi-agent air quality data
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import type { OrchestratorState } from '../agents/types';
import { buildInitialAgentStatuses, runOrchestration } from '../agents/orchestrator';

interface AQStore extends OrchestratorState {
  selectedCity: string;
  activeTab: 'dashboard' | 'map' | 'health' | 'forecast' | 'community';
  darkMode: boolean;
  unreadCount: number;

  setCity: (city: string) => void;
  setActiveTab: (tab: AQStore['activeTab']) => void;
  toggleDarkMode: () => void;
  refresh: () => Promise<void>;
  markAllRead: () => void;
  dismissNotification: (id: string) => void;
}

export const useAQStore = create<AQStore>((set, get) => ({
  // ── OrchestratorState ────────────────────────────────────────────────────
  agents: buildInitialAgentStatuses(),
  currentReading: null,
  historical: [],
  advisories: [],
  forecast: null,
  communityInsights: null,
  notifications: [],
  isLoading: false,
  lastRefresh: null,

  // ── App State ────────────────────────────────────────────────────────────
  selectedCity: 'New York',
  activeTab: 'dashboard',
  darkMode: true,
  unreadCount: 0,

  // ── Actions ───────────────────────────────────────────────────────────────
  setCity: (city) => {
    set({ selectedCity: city });
    get().refresh();
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),

  refresh: async () => {
    const { selectedCity } = get();
    await runOrchestration(
      selectedCity,
      (updater) => set((state) => ({ ...state, ...updater(state) })),
      get,
    );
    // Update unread count
    const unread = get().notifications.filter((n) => !n.read).length;
    set({ unreadCount: unread });
  },

  markAllRead: () => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  dismissNotification: (id) => {
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
      unreadCount: s.notifications.filter((n) => !n.read && n.id !== id).length,
    }));
  },
}));
