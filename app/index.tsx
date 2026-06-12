import { Redirect } from 'expo-router';
import { useAppStore } from '../src/stores/appStore';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '../src/config/theme';

export default function IndexScreen() {
  const userId = useAppStore((s) => s.userId);
  const isAuthLoading = useAppStore((s) => s.isAuthLoading);
  const hasCompletedOnboarding = useAppStore((s) => s.hasCompletedOnboarding);

  // Show loading while checking auth
  if (isAuthLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>🩺</Text>
        </View>
        <Text style={styles.appName}>GlucoScan</Text>
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 20 }} />
      </View>
    );
  }

  // Not logged in → show onboarding or auth
  if (!userId) {
    if (!hasCompletedOnboarding) {
      return <Redirect href="/(onboarding)" />;
    }
    return <Redirect href="/(auth)" />;
  }

  // Logged in → go to main app
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 40,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
});
