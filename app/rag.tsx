import { useRouter } from 'expo-router';
import { RagScreen } from '../src/screens/RagScreen';
import { useAppStore } from '../src/stores/appStore';

export default function RagRoute() {
  const router = useRouter();
  const userId = useAppStore((s) => s.userId);

  return (
    <RagScreen
      userId={userId}
      onClose={() => router.back()}
    />
  );
}
