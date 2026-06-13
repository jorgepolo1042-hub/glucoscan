import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScanResult } from '../screens/ScannerScreen';
import type { PlanWithRecipes } from '../services/planService';

const ONBOARDING_KEY = 'glucoscan_onboarding_complete';

interface AppState {
  // Auth
  userId: string | null;
  isAuthLoading: boolean;
  setUserId: (id: string | null) => void;
  setIsAuthLoading: (v: boolean) => void;

  // Onboarding
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (v: boolean) => void;
  loadOnboardingStatus: () => Promise<void>;
  saveOnboardingComplete: () => Promise<void>;

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
  setHasCompletedOnboarding: (value) => set({ hasCompletedOnboarding: value }),
  loadOnboardingStatus: async () => {
    try {
      const stored = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (stored === 'true') {
        set({ hasCompletedOnboarding: true });
      }
    } catch { /* ignore storage errors */ }
  },
  saveOnboardingComplete: async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch { /* ignore */ }
  },

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
