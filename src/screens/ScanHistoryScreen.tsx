import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { supabase } from "../lib/supabase";
import { LoadingSpinner } from "../components/LoadingSpinner";
import {
  getCachedScans,
  refreshCache,
  checkConnectivity,
} from "../services/offlineService";
import type { FoodScan } from "../types/database.types";
import { theme } from "../config/theme";
import { ScreenHeader } from "../components/ui/ScreenHeader";

const PAGE_SIZE = 20;

interface ScanHistoryScreenProps {
  onClose: () => void;
}

export function ScanHistoryScreen({ onClose }: ScanHistoryScreenProps) {
  const [scans, setScans] = useState<FoodScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadScans = useCallback(async (options: { refresh?: boolean; append?: boolean } = {}) => {
    const { refresh = false, append = false } = options;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setScans([]);
        setHasMore(false);
        return;
      }
      const online = await checkConnectivity();

      if (online) {
        const start = append ? scans.length : 0;
        const { data, error: fetchError } = await supabase
          .from("food_scans")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .range(start, start + PAGE_SIZE - 1);

        if (fetchError) throw fetchError;
        if (append) {
          setScans((prev) => [...prev, ...(data ?? [])]);
        } else {
          setScans(data ?? []);
        }
        setHasMore((data ?? []).length === PAGE_SIZE);
        if (!append) refreshCache().catch(console.error);
      } else {
        const cached = await getCachedScans(60 * 60 * 1000);
        if (cached) {
          setScans(cached);
          setHasMore(false);
        } else {
          setError("No cached data available. Connect to the internet to load scan history.");
        }
      }
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load scans";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [scans.length]);

  useEffect(() => { loadScans(); }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadScans({ refresh: true });
  }, [loadScans]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    loadScans({ append: true });
  }, [loadingMore, hasMore, loadScans]);

  const renderScanItem = useCallback(({ item }: { item: FoodScan }) => (
    <View style={styles.scanCard}>
      <View style={styles.scanCardLeft}>
        <Text style={styles.scanIcon}>
          {item.scan_type === "photo" ? "📸" : item.scan_type === "barcode" ? "📊" : "✏️"}
        </Text>
        <View style={styles.scanInfo}>
          <Text style={styles.scanName} numberOfLines={1}>
            {item.product_name || item.barcode || "Unknown product"}
          </Text>
          <Text style={styles.scanDate}>
            {new Date(item.created_at).toLocaleDateString(undefined, {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </Text>
          {item.calories != null && (
            <Text style={styles.scanMeta}>
              {item.calories} cal
              {item.sugar_grams != null && ` · ${item.sugar_grams}g sugar`}
              {item.carbs_grams != null && ` · ${item.carbs_grams}g carbs`}
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.scanSugarBadge}>
        {item.is_sugar_free ? "✅" : "🍬"}
      </Text>
    </View>
  ), []);

  const renderFooter = useCallback(() => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.footerText}>Loading more...</Text>
        </View>
      );
    }
    if (!hasMore && scans.length > 0) {
      return <Text style={styles.endText}>All scans loaded</Text>;
    }
    return null;
  }, [loadingMore, hasMore, scans.length]);

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    if (error) {
      return (
        <View style={styles.centerState}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.8 }]} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.centerState}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyTitle}>No scans yet</Text>
        <Text style={styles.emptySub}>Your scanned food history will appear here</Text>
      </View>
    );
  }, [loading, error, handleRefresh]);

  if (loading) {
    return (
      <View style={styles.container}>      <ScreenHeader title="Scan History" icon="📊" onClose={onClose} />
        <LoadingSpinner fullScreen color={theme.colors.primary} label="Loading scans..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Scan History"
        icon="📊"
        onClose={onClose}
        rightAction={
          <View style={styles.headerCountBadge}>
            <Text style={styles.headerCountText}>{scans.length}</Text>
          </View>
        }
      />

      <FlatList
        data={scans}
        keyExtractor={(item) => item.id}
        renderItem={renderScanItem}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  // Header provided by ScreenHeader component
  headerCountBadge: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 40,
    alignItems: "center",
  },
  headerCountText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },

  // Scan card
  scanCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 14,
    marginBottom: 8,
    ...theme.shadow.sm,
  },
  scanCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  scanIcon: { fontSize: 22 },
  scanInfo: { flex: 1 },
  scanName: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  scanDate: {
    color: theme.colors.textTertiary,
    fontSize: 11,
    marginTop: 1,
  },
  scanMeta: {
    color: theme.colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  scanSugarBadge: { fontSize: 18 },

  // States
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  emptySub: {
    color: theme.colors.textTertiary,
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },
  errorIcon: { fontSize: 36, marginBottom: 8 },
  errorText: {
    color: theme.colors.danger,
    fontSize: 15,
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: theme.radius.md,
  },
  retryButtonText: {
    color: theme.colors.textInverse,
    fontSize: 14,
    fontWeight: "600",
  },

  // Footer
  footerLoader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  footerText: {
    color: theme.colors.textTertiary,
    fontSize: 13,
  },
  endText: {
    color: theme.colors.textTertiary,
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 16,
  },
});
