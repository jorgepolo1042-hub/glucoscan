import { useRouter } from 'expo-router';
import { PlansScreen } from '../../src/screens/PlansScreen';
import { useAppStore } from '../../src/stores/appStore';
import type { PlanWithRecipes } from '../../src/services/planService';

export default function PlansRoute() {
  const router = useRouter();
  const userId = useAppStore((s) => s.userId);
  const setPlanDetail = useAppStore((s) => s.setPlanDetail);

  const handleViewPlan = (plan: PlanWithRecipes) => {
    setPlanDetail(plan);
    router.push(`/plan/${plan.id}`);
  };

  return (
    <PlansScreen
      userId={userId}
      onClose={() => router.back()}
      onViewPlan={handleViewPlan}
    />
  );
}
