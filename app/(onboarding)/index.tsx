import { useRouter } from 'expo-router';
import { OnboardingScreen } from '../../src/screens/OnboardingScreen';
import { useAppStore } from '../../src/stores/appStore';

export default function OnboardingRoute() {
  const router = useRouter();
  const setHasCompletedOnboarding = useAppStore((s) => s.setHasCompletedOnboarding);
  const saveOnboardingComplete = useAppStore((s) => s.saveOnboardingComplete);

  const handleComplete = async () => {
    setHasCompletedOnboarding(true);
    await saveOnboardingComplete();
    router.replace('/(auth)');
  };

  return <OnboardingScreen onComplete={handleComplete} />;
}
