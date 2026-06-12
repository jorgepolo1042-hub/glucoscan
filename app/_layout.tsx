import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '../src/lib/supabase';
import { useAppStore } from '../src/stores/appStore';
import {
  initRevenueCat,
} from '../src/services/subscriptionService';
import {
  initNetworkListener,
  syncPendingScans,
  onNetworkChange,
  getPendingCount,
} from '../src/services/offlineService';

export default function RootLayout() {
  const { setUserId, setIsAuthLoading, setIsOffline, setPendingSync } = useAppStore();

  // Check auth session
  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (user) {
          setUserId(user.id);
          initRevenueCat(user.id).catch(console.error);
        }
      })
      .catch(() => {})
      .finally(() => setIsAuthLoading(false));
  }, []);

  // Auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Network listener
  useEffect(() => {
    const unsubNetInfo = initNetworkListener();
    const unsubNetworkChange = onNetworkChange(async (online) => {
      setIsOffline(!online);
      if (online) {
        await syncPendingScans();
      }
      const count = await getPendingCount();
      setPendingSync(count);
    });
    getPendingCount().then(setPendingSync);
    return () => {
      unsubNetInfo();
      unsubNetworkChange();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          animation: 'slide_from_right',
          animationDuration: 300,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="scanner"
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
            gestureDirection: 'vertical',
          }}
        />
        <Stack.Screen
          name="result"
          options={{ animation: 'fade_from_bottom' }}
        />
        <Stack.Screen
          name="scan-history"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="rag"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="plan/[id]"
          options={{ animation: 'slide_from_right' }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
