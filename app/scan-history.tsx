import { useRouter } from 'expo-router';
import { ScanHistoryScreen } from '../src/screens/ScanHistoryScreen';

export default function ScanHistoryRoute() {
  const router = useRouter();

  return (
    <ScanHistoryScreen
      onClose={() => router.back()}
    />
  );
}
