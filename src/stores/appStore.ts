import { create } from 'zustand';
import type { ScanResult } from '../screens/ScannerScreen';
import type { PlanWithRecipes } from '../services/planService';

interface AppState {
  // Auth
  userId: string | null;
  isAuthLoading: boolean;
  setUserId: (id: string | null) => void;
  setIsAuthLoading: (v: boolean) => void;

  // Onboarding
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (v: boolean) => void;

  // Navigation data (passthrough between screens)
  scanResult: ScanResult | null;
  setScanResult: (r: ScanResult | null) => void;
  planDetail: PlanWithRecipes | null;
  setPlanDetail: (p: PlanWithRecipes | null) => void;

  // Dashboard
  currentStreak: number;
  dailyScans: number;
  setCurrentStreak: (v: number) => void;
  setDailyScans: (v: number) => void;

  // UI
  isOffline: boolean;
  pendingSync: number;
  isSaving: boolean;
  setIsOffline: (v: boolean) => void;
  setPendingSync: (v: number) => void;
  setIsSaving: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  userId: null,
  isAuthLoading: true,
  setUserId: (userId) => set({ userId }),
  setIsAuthLoading: (isAuthLoading) => set({ isAuthLoading }),

  // Onboarding
  hasCompletedOnboarding: false,
  setHasCompletedOnboarding: (hasCompletedOnboarding) => set({ hasCompletedOnboarding }),

  // Navigation data
  scanResult: null,
  setScanResult: (scanResult) => set({ scanResult }),
  planDetail: null,
  setPlanDetail: (planDetail) => set({ planDetail }),

  // Dashboard
  currentStreak: 0,
  dailyScans: 0,
  setCurrentStreak: (currentStreak) => set({ currentStreak }),
  setDailyScans: (dailyScans) => set({ dailyScans }),

  // UI
  isOffline: false,
  pendingSync: 0,
  isSaving: false,
  setIsOffline: (isOffline) => set({ isOffline }),
  setPendingSync: (pendingSync) => set({ pendingSync }),
  setIsSaving: (isSaving) => set({ isSaving }),
}));
