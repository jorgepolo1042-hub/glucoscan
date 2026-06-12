import { useRouter } from 'expo-router';
import { AuthScreen } from '../../src/screens/AuthScreen';
import { useAppStore } from '../../src/stores/appStore';
import {
  initRevenueCat,
} from '../../src/services/subscriptionService';
import { getStreakData } from '../../src/services/streakService';
import { getDailyScanCount } from '../../src/services/scanService';

export default function AuthRoute() {
  const router = useRouter();
  const setUserId = useAppStore((s) => s.setUserId);
  const setCurrentStreak = useAppStore((s) => s.setCurrentStreak);
  const setDailyScans = useAppStore((s) => s.setDailyScans);

  const handleAuthSuccess = async (userId: string) => {
    setUserId(userId);
    initRevenueCat(userId).catch(console.error);

    // Load initial dashboard data
    try {
      const [streakData, scanCount] = await Promise.all([
        getStreakData(userId),
        getDailyScanCount(),
      ]);
      setCurrentStreak(streakData.currentStreak);
      setDailyScans(scanCount);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }

    router.replace('/(tabs)');
  };

  return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
}
