import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ScanResultScreen } from '../src/screens/ScanResultScreen';
import { useAppStore } from '../src/stores/appStore';
import { saveScan } from '../src/services/scanService';
import { autoCheckInFromScans } from '../src/services/streakService';

export default function ResultRoute() {
  const router = useRouter();
  const scanResult = useAppStore((s) => s.scanResult);
  const userId = useAppStore((s) => s.userId);
  const isSaving = useAppStore((s) => s.isSaving);
  const setIsSaving = useAppStore((s) => s.setIsSaving);

  const handleSave = useCallback(async () => {
    if (!scanResult) return;
    setIsSaving(true);
    try {
      const r = scanResult;
      const combined = r.combinedResult;
      await saveScan({
        scanType: r.scanType,
        barcode: r.barcodeData,
        productName: combined?.productName,
        brand: combined?.brand,
        calories: combined?.calories,
        sugarGrams: combined?.sugarGrams,
        carbsGrams: combined?.carbsGrams,
        proteinGrams: combined?.proteinGrams,
        fatGrams: combined?.fatGrams,
        fiberGrams: combined?.fiberGrams,
        imageUrl: combined?.imageUrl,
        ingredients: combined?.ingredients,
        nutritionalScore: combined?.nutritionalScore,
        isSugarFree: combined?.isSugarFree,
        aiAnalysis: r.photoAnalysis
          ? { description: r.photoAnalysis.description, rawResponse: r.photoAnalysis.rawResponse }
          : null,
      });
      if (userId) {
        autoCheckInFromScans(userId).catch(console.error);
      }
      router.replace('/(tabs)');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error saving';
      alert(message);
    } finally {
      setIsSaving(false);
    }
  }, [scanResult, userId]);

  if (!scanResult) {
    router.replace('/(tabs)');
    return null;
  }

  return (
    <ScanResultScreen
      result={scanResult}
      onSave={handleSave}
      onRetake={() => router.replace('/scanner')}
      isSaving={isSaving}
    />
  );
}
