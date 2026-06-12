import { supabase } from "../lib/supabase";
import type { FoodScan } from "../types/database.types";
import {
  checkConnectivity,
  cacheScans,
  getCachedScans,
  queueScan,
} from "./offlineService";

export interface ScanInput {
  scanType: "barcode" | "photo" | "manual";
  barcode?: string | null;
  productName?: string | null;
  brand?: string | null;
  calories?: number | null;
  sugarGrams?: number | null;
  carbsGrams?: number | null;
  proteinGrams?: number | null;
  fatGrams?: number | null;
  fiberGrams?: number | null;
  imageUrl?: string | null;
  ingredients?: string | null;
  nutritionalScore?: string | null;
  aiAnalysis?: Record<string, unknown> | null;
  isSugarFree?: boolean;
}

export async function saveScan(input: ScanInput): Promise<FoodScan | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User must be authenticated to save a scan");
  }

  const scanRecord = {
    user_id: user.id,
    scan_type: input.scanType,
    barcode: input.barcode ?? null,
    product_name: input.productName ?? null,
    brand: input.brand ?? null,
    calories: input.calories ?? null,
    sugar_grams: input.sugarGrams ?? null,
    carbs_grams: input.carbsGrams ?? null,
    protein_grams: input.proteinGrams ?? null,
    fat_grams: input.fatGrams ?? null,
    fiber_grams: input.fiberGrams ?? null,
    image_url: input.imageUrl ?? null,
    ingredients: input.ingredients ?? null,
    nutritional_score: input.nutritionalScore ?? null,
    ai_analysis: (input.aiAnalysis as Record<string, unknown> | null) ?? null,
    is_sugar_free: input.isSugarFree ?? false,
  };

  // Check if online before trying to save
  const online = await checkConnectivity();

  if (!online) {
    // Queue the scan for later sync
    await queueScan(scanRecord as unknown as Record<string, unknown>);
    return null;
  }

  const { data, error } = await supabase
    .from("food_scans")
    .insert(scanRecord)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save scan: ${error.message}`);
  }

  return data;
}

export async function getRecentScans(limit = 20): Promise<FoodScan[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const online = await checkConnectivity();

  if (online) {
    const { data } = await supabase
      .from("food_scans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    const scans = data ?? [];
    // Update cache in background
    cacheScans(scans).catch(console.error);
    return scans;
  }

  // Offline: return cached data
  const cached = await getCachedScans();
  return cached ?? [];
}

export async function getDailyScanCount(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { count } = await supabase
    .from("food_scans")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", todayStart);

  return count ?? 0;
}
