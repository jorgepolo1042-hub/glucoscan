import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/stores/appStore';
import { getStreakData } from '../../src/services/streakService';
import { getDailyScanCount } from '../../src/services/scanService';
import { HomeScreen } from '../../src/screens/HomeScreen';

export default function HomeRoute() {
  const router = useRouter();
  const {
    userId,
    currentStreak,
    dailyScans,
    isOffline,
    pendingSync,
    setCurrentStreak,
    setDailyScans,
  } = useAppStore();

  useEffect(() => {
    if (userId) {
      Promise.all([
        getStreakData(userId),
        getDailyScanCount(),
      ])
        .then(([streakData, scanCount]) => {
          setCurrentStreak(streakData.currentStreak);
          setDailyScans(scanCount);
        })
        .catch(console.error);
    }
  }, [userId]);

  return (
    <HomeScreen
      userId={userId}
      currentStreak={currentStreak}
      dailyScans={dailyScans}
      isOffline={isOffline}
      pendingSync={pendingSync}
      onStartScan={() => router.push('/scanner')}
      onOpenStreaks={() => router.push('/(tabs)/streaks')}
      onOpenPlans={() => router.push('/(tabs)/plans')}
      onOpenRag={() => router.push('/(tabs)/rag')}
      onOpenProfile={() => router.push('/(tabs)/profile')}
    />
  );
}
