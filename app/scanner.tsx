import { useRouter } from 'expo-router';
import { ScannerScreen } from '../src/screens/ScannerScreen';
import { useAppStore } from '../src/stores/appStore';
import type { ScanResult } from '../src/screens/ScannerScreen';

export default function ScannerRoute() {
  const router = useRouter();
  const setScanResult = useAppStore((s) => s.setScanResult);

  const handleScanComplete = (result: ScanResult) => {
    setScanResult(result);
    router.replace('/result');
  };

  return (
    <ScannerScreen
      onScanComplete={handleScanComplete}
      onClose={() => router.back()}
    />
  );
}
