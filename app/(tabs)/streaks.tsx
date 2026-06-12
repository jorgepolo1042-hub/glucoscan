import { useRouter } from 'expo-router';
import { StreakScreen } from '../../src/screens/StreakScreen';
import { useAppStore } from '../../src/stores/appStore';

export default function StreaksRoute() {
  const router = useRouter();
  const userId = useAppStore((s) => s.userId);

  return (
    <StreakScreen
      userId={userId}
      onClose={() => router.back()}
    />
  );
}
