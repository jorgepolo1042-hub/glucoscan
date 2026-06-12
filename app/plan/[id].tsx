import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/stores/appStore';
import { PlanDetailScreen } from '../../src/screens/PlanDetailScreen';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '../../src/config/theme';

export default function PlanDetailRoute() {
  const router = useRouter();
  const planDetail = useAppStore((s) => s.planDetail);

  if (!planDetail) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.text}>Loading plan...</Text>
      </View>
    );
  }

  return (
    <PlanDetailScreen
      plan={planDetail}
      onClose={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  text: {
    marginTop: 12,
    color: theme.colors.textSecondary,
    fontSize: 15,
  },
});
