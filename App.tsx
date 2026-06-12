import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from './src/config/theme';

// This is a fallback entry point.
// In production builds with Expo Router, the app/ directory routes take over.
// We keep this for backward compatibility with index.ts -> registerRootComponent(App).

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>🩺</Text>
        </View>
        <Text style={styles.appName}>GlucoScan</Text>
        <ActivityIndicator
          size="large"
          color={theme.colors.primary}
          style={{ marginTop: 20 }}
        />
      </View>
    </SafeAreaProvider>
  );
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
