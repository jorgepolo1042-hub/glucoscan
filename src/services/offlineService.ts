import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { supabase } from "../lib/supabase";
import type { FoodScan } from "../types/database.types";

// ── Keys ───────────────────────────────────────────────
const CACHE_KEY = "glucoscan_scans_cache";
const PENDING_KEY = "glucoscan_pending_scans";
const LAST_SYNC_KEY = "glucoscan_last_sync";

// ── Network status ─────────────────────────────────────

let _isOnline = true;
const _listeners: Array<(online: boolean) => void> = [];

export function initNetworkListener() {
  return NetInfo.addEventListener((state) => {    const online = state.isConnected ?? true;
    _isOnline = online;

    _listeners.forEach((fn) => fn(online));
  });
}

export function onNetworkChange(fn: (online: boolean) => void) {
  _listeners.push(fn);
  return () => {
    const idx = _listeners.indexOf(fn);
    if (idx >= 0) _listeners.splice(idx, 1);
  };
}

export function isOnline(): boolean {
  return _isOnline;
}

export async function checkConnectivity(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected ?? true;
}

// ── Scan cache ─────────────────────────────────────────

export async function cacheScans(scans: FoodScan[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(scans));
  } catch (error) {
    console.error("Failed to cache scans:", error);
  }
}

export async function getCachedScans(maxAgeMs = 5 * 60 * 1000): Promise<FoodScan[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    // Check if cache is stale
    const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
    if (lastSync) {
      const age = Date.now() - parseInt(lastSync, 10);
      if (age > maxAgeMs) return null; // Cache expired
    }

    return JSON.parse(raw) as FoodScan[];
  } catch {
    return null;
  }
}

export async function clearCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
    await AsyncStorage.removeItem(LAST_SYNC_KEY);
  } catch (error) {
    console.error("Failed to clear cache:", error);
  }
}

// ── Pending queue ──────────────────────────────────────

export interface PendingScan {
  id: string;
  scanInput: Record<string, unknown>;
  createdAt: string;
}

export async function queueScan(scanInput: Record<string, unknown>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const queue: PendingScan[] = raw ? JSON.parse(raw) : [];

    queue.push({
      id: Date.now().toString(),
      scanInput,
      createdAt: new Date().toISOString(),
    });

    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error("Failed to queue scan:", error);
  }
}

export async function getPendingCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return 0;
    const queue: PendingScan[] = JSON.parse(raw);
    return queue.length;
  } catch {
    return 0;
  }
}

export async function syncPendingScans(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return 0;

    const queue: PendingScan[] = JSON.parse(raw);
    if (queue.length === 0) return 0;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    let synced = 0;
    const failed: PendingScan[] = [];

    for (const item of queue) {
      const { error } = await supabase
        .from("food_scans")
        .insert({
          ...item.scanInput,
          user_id: user.id,
        });

      if (error) {
        failed.push(item);
      } else {
        synced++;
      }
    }

    // Update queue with only failed items
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(failed));

    // Update last sync timestamp
    await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));

    return synced;
  } catch (error) {
    console.error("Failed to sync pending scans:", error);
    return 0;
  }
}

// ── Full sync (cache + pending) ────────────────────────

export async function refreshCache(): Promise<FoodScan[] | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("food_scans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const scans = data ?? [];
    await cacheScans(scans);
    await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    return scans;
  } catch {
    return null;
  }
}
