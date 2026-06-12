import { useRouter } from 'expo-router';
import { ProfileScreen } from '../../src/screens/ProfileScreen';
import { useAppStore } from '../../src/stores/appStore';

export default function ProfileRoute() {
  const router = useRouter();
  const userId = useAppStore((s) => s.userId);

  return (
    <ProfileScreen
      userId={userId ?? ''}
      onClose={() => router.back()}
      onViewAllScans={() => router.push('/scan-history')}
    />
  );
}
