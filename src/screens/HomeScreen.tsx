import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../config/theme';
import { MAX_FREE_SCANS } from '../services/subscriptionService';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { ScreenHeader } from '../components/ui/ScreenHeader';

interface HomeScreenProps {
  userId: string | null;
  currentStreak: number;
  dailyScans: number;
  isOffline: boolean;
  pendingSync: number;
  onStartScan: () => void;
  onOpenStreaks: () => void;
  onOpenPlans: () => void;
  onOpenRag: () => void;
  onOpenProfile: () => void;
}

export function HomeScreen({
  currentStreak,
  dailyScans,
  isOffline,
  pendingSync,
  onStartScan,
  onOpenStreaks,
  onOpenPlans,
  onOpenRag,
  onOpenProfile,
}: HomeScreenProps) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}
          onPress={onOpenProfile}
        >
          <Text style={styles.iconButtonText}>👤</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.appName}>
            <Text style={styles.appNameEmoji}>🩺 </Text>GlucoScan
          </Text>
          <Text style={styles.appTagline}>Scan food. Track sugar. Stay healthy.</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}
          onPress={onOpenProfile}
        >
          <Text style={styles.iconButtonText}>⚙️</Text>
        </Pressable>
      </View>

      {/* Offline banner */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📡 You're offline — scans will sync when connected
            {pendingSync > 0 ? ` (${pendingSync} pending)` : ''}
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Scan Button */}
        <AnimatedButton
          title="Scan Food"
          icon="📸"
          onPress={onStartScan}
          style={{ marginBottom: 20, borderRadius: 20, paddingVertical: 24 }}
        />

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Pressable
            style={({ pressed }) => [styles.statCard, pressed && { opacity: 0.9 }]}
            onPress={onOpenStreaks}
          >
            <Text style={styles.statIcon}>{currentStreak > 0 ? '🔥' : '💪'}</Text>
            <Text style={styles.statValue}>{currentStreak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </Pressable>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📊</Text>
            <Text style={styles.statValue}>{dailyScans}/{MAX_FREE_SCANS}</Text>
            <Text style={styles.statLabel}>Today's Scans</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <Pressable
              style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.9 }]}
              onPress={onOpenPlans}
            >
              <View style={[styles.actionIconWrapper, { backgroundColor: theme.colors.primaryLight }]}>
                <Text style={styles.actionIcon}>📋</Text>
              </View>
              <Text style={styles.actionTitle}>Meal Plans</Text>
              <Text style={styles.actionSub}>AI-generated nutrition</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.9 }]}
              onPress={onOpenRag}
            >
              <View style={[styles.actionIconWrapper, { backgroundColor: '#EEF2FF' }]}>
                <Text style={styles.actionIcon}>🤖</Text>
              </View>
              <Text style={styles.actionTitle}>Assistant</Text>
              <Text style={styles.actionSub}>Clinical Q&A with AI</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerCenter: {
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonText: {
    fontSize: 18,
  },
  appName: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  appNameEmoji: {
    fontSize: 20,
  },
  appTagline: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  offlineBanner: {
    backgroundColor: theme.colors.warning,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  offlineBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  actionsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionIcon: {
    fontSize: 22,
  },
  actionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionSub: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
});
