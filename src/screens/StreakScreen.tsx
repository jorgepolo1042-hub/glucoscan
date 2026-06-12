import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { supabase } from "../lib/supabase";
import {
  getStreakData,
  checkInToday,
  type StreakData,
} from "../services/streakService";
import { theme } from "../config/theme";
import { ScreenHeader } from "../components/ui/ScreenHeader";

interface StreakScreenProps {
  onClose: () => void;
  userId: string | null;
}

const DAYS_TO_SHOW = 60;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY_COLORS = {
  "sugar-free": theme.colors.success,
  "not-sugar-free": theme.colors.glucoseBad,
  empty: theme.colors.surfaceSecondary,
  future: theme.colors.background,
} as const;

export function StreakScreen({ onClose, userId }: StreakScreenProps) {
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  const loadStreakData = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getStreakData(userId);
      setStreakData(data);
    } catch (error) {
      console.error("Failed to load streak data:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadStreakData();
  }, [loadStreakData]);

  const handleCheckIn = useCallback(
    async (isSugarFree: boolean) => {
      if (!userId) return;
      setCheckingIn(true);
      try {
        await checkInToday(userId, isSugarFree);
        await loadStreakData();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to check in";
        Alert.alert("Error", msg);
      } finally {
        setCheckingIn(false);
      }
    },
    [userId, loadStreakData]
  );

  const getDayStatus = (
    daysAgo: number
  ): "sugar-free" | "not-sugar-free" | "empty" | "future" => {
    if (!streakData) return "empty";
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = streakData.streakHistory.find((e) => e.date === dateStr);
    if (!entry) return daysAgo === 0 ? "empty" : "empty";
    return entry.is_sugar_free ? "sugar-free" : "not-sugar-free";
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <LoadingSpinner fullScreen color={theme.colors.primary} label="Loading streak data..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Sugar-Free Streak" icon="🔥" onClose={onClose} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Current streak hero */}
        <Animated.View style={styles.streakHero} entering={FadeInDown.duration(500)}>
          <Text style={styles.streakEmoji}>
            {(streakData?.currentStreak ?? 0) > 0 ? "🔥" : "💪"}
          </Text>
          <Text style={styles.streakCount}>{streakData?.currentStreak ?? 0}</Text>
          <Text style={styles.streakLabel}>
            {(streakData?.currentStreak ?? 0) === 1 ? "Day" : "Days"} sugar-free
          </Text>

          {streakData && streakData.currentStreak > 0 && (
            <Animated.View style={styles.streakMilestones} entering={FadeIn.duration(400).delay(300)}>
              {[7, 14, 21, 30, 60, 90].map(
                (milestone) =>
                  streakData.currentStreak >= milestone && (
                    <View key={milestone} style={styles.milestoneBadge}>
                      <Text style={styles.milestoneText}>🏆 {milestone} days</Text>
                    </View>
                  )
              )}
            </Animated.View>
          )}
        </Animated.View>

        {/* Stats row */}
        <Animated.View style={styles.statsRow} entering={FadeInDown.duration(500).delay(150)}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{streakData?.longestStreak ?? 0}</Text>
            <Text style={styles.statLabel}>Longest Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {streakData?.todayCheckedIn ? "✅" : "⭕"}
            </Text>
            <Text style={styles.statLabel}>
              {streakData?.todayCheckedIn ? "Checked In" : "Not Yet"}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {streakData
                ? streakData.streakHistory.filter((e) => e.is_sugar_free).length
                : 0}
            </Text>
            <Text style={styles.statLabel}>Sugar-Free Days</Text>
          </View>
        </Animated.View>

        {/* Today check-in */}
        <Animated.View style={styles.checkInCard} entering={FadeInDown.duration(500).delay(300)}>
          <Text style={styles.sectionTitle}>Today's Check-in</Text>
          <Text style={styles.sectionSubtitle}>
            {streakData?.todayCheckedIn
              ? streakData.todayIsSugarFree
                ? "✅ You're sugar-free today! Keep it up!"
                : "Today wasn't sugar-free. Tomorrow is a new day!"
              : "Did you stay sugar-free today?"}
          </Text>

          {!streakData?.todayCheckedIn && (
            <View style={styles.checkInButtons}>
              <Pressable
                style={({ pressed }) => [styles.checkInBtn, styles.sugarFreeBtn, pressed && !checkingIn && { opacity: 0.8 }]}
                onPress={() => handleCheckIn(true)}
                disabled={checkingIn}
              >
                {checkingIn ? (
                  <ActivityIndicator color={theme.colors.textInverse} />
                ) : (
                  <>
                    <Text style={styles.checkInBtnIcon}>✅</Text>
                    <Text style={styles.checkInBtnText}>Yes, sugar-free!</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.checkInBtn, styles.notSugarFreeBtn, pressed && !checkingIn && { opacity: 0.8 }]}
                onPress={() => handleCheckIn(false)}
                disabled={checkingIn}
              >
                <Text style={styles.checkInBtnIcon}>❌</Text>
                <Text style={styles.checkInBtnText}>Had sugar</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>

        {/* Calendar grid */}
        <Animated.View style={styles.calendarCard} entering={FadeInDown.duration(500).delay(450)}>
          <Text style={styles.sectionTitle}>Last {DAYS_TO_SHOW} Days</Text>

          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day) => (
              <Text key={day} style={styles.weekdayLabel}>{day}</Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {Array.from({ length: DAYS_TO_SHOW }, (_, i) => {
              const daysAgo = DAYS_TO_SHOW - 1 - i;
              const status = getDayStatus(daysAgo);
              const d = new Date();
              d.setDate(d.getDate() - daysAgo);
              const dayNum = d.getDate();

              return (
                <View
                  key={i}
                  style={[
                    styles.dayCell,
                    { backgroundColor: DAY_COLORS[status] },
                    status === "sugar-free" && styles.dayCellGlow,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayCellText,
                      (status === "sugar-free" || status === "not-sugar-free") && styles.dayCellTextActive,
                    ]}
                  >
                    {dayNum}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: DAY_COLORS["sugar-free"] }]} />
              <Text style={styles.legendText}>Sugar-free</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: DAY_COLORS["not-sugar-free"] }]} />
              <Text style={styles.legendText}>Had sugar</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: DAY_COLORS["empty"] }]} />
              <Text style={styles.legendText}>No data</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // Header provided by ScreenHeader component

  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Streak hero
  streakHero: {
    alignItems: "center",
    paddingVertical: 32,
  },
  streakEmoji: { fontSize: 48, marginBottom: 8 },
  streakCount: {
    color: theme.colors.textPrimary,
    fontSize: 64,
    fontWeight: "800",
  },
  streakLabel: {
    color: theme.colors.textSecondary,
    fontSize: 18,
    marginTop: 4,
  },
  streakMilestones: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  milestoneBadge: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  milestoneText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
    alignItems: "center",
    ...theme.shadow.sm,
  },
  statValue: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
  },
  statLabel: {
    color: theme.colors.textTertiary,
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },

  // Check-in
  checkInCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    marginHorizontal: 16,
    padding: 20,
    marginBottom: 16,
    ...theme.shadow.md,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  checkInButtons: {
    flexDirection: "row",
    gap: 12,
  },
  checkInBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: theme.radius.lg,
  },
  sugarFreeBtn: {
    backgroundColor: theme.colors.success,
  },
  notSugarFreeBtn: {
    backgroundColor: theme.colors.danger,
  },
  checkInBtnIcon: { fontSize: 18 },
  checkInBtnText: {
    color: theme.colors.textInverse,
    fontSize: 15,
    fontWeight: "600",
  },

  // Calendar
  calendarCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    marginHorizontal: 16,
    padding: 20,
    ...theme.shadow.sm,
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
    marginTop: 12,
  },
  weekdayLabel: {
    color: theme.colors.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    width: 30,
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  dayCell: {
    width: 30,
    height: 30,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  dayCellGlow: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    ...theme.shadow.sm,
  },
  dayCellText: {
    color: theme.colors.textTertiary,
    fontSize: 11,
    fontWeight: "500",
  },
  dayCellTextActive: {
    color: theme.colors.textInverse,
    fontWeight: "700",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: theme.colors.textTertiary,
    fontSize: 12,
  },
});
