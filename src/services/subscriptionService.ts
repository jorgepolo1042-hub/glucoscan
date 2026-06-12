import { Platform } from "react-native";
import Purchases, { PurchasesOffering, type PurchasesPackage } from "react-native-purchases";
import { getDailyScanCount } from "./scanService";

const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? "";
const REVENUECAT_API_KEY_ANDROID =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? "";

const ENTITLEMENT_ID = "pro_access";
export const MAX_FREE_SCANS = 5;

// ── Types ──────────────────────────────────────────────

export interface SubscriptionStatus {
  isPro: boolean;
  currentScanCount: number;
  scansRemaining: number;
  canScan: boolean;
  offering: PurchasesOffering | null;
}

// ── Initialization ─────────────────────────────────────

export async function initRevenueCat(userId: string): Promise<void> {
  const apiKey =
    Platform.OS === "ios" ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

  if (!apiKey) {
    console.warn(
      `RevenueCat API key not configured for ${Platform.OS}. Set EXPO_PUBLIC_REVENUECAT_API_KEY in .env`
    );
    return;
  }

  try {
    await Purchases.configure({ apiKey, appUserID: userId });
  } catch (error) {
    console.error("RevenueCat init failed:", error);
  }
}

// ── Subscription checks ────────────────────────────────

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  let offering: PurchasesOffering | null = null;

  try {
    const [customerInfo, offerings] = await Promise.all([
      Purchases.getCustomerInfo(),
      Purchases.getOfferings(),
    ]);
    offering = offerings.current ?? null;

    const isPro = customerInfo?.entitlements.active[ENTITLEMENT_ID] !== undefined;
    const currentScanCount = isPro ? 0 : await getDailyScanCount();

    return {
      isPro,
      currentScanCount,
      scansRemaining: isPro ? Infinity : Math.max(0, MAX_FREE_SCANS - currentScanCount),
      canScan: isPro || currentScanCount < MAX_FREE_SCANS,
      offering,
    };
  } catch {
    // RevenueCat not initialized — default to free tier
    const currentScanCount = await getDailyScanCount();
    return {
      isPro: false,
      currentScanCount,
      scansRemaining: Math.max(0, MAX_FREE_SCANS - currentScanCount),
      canScan: currentScanCount < MAX_FREE_SCANS,
      offering: null,
    };
  }
}

// ── Purchase & Restore ───────────────────────────────────

export async function purchasePackage(
  pkg: PurchasesPackage
): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo?.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (error: any) {
    if (error?.userCancelled) {
      return false; // User cancelled — not a real error
    }
    console.error("Purchase failed:", error);
    throw error;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo?.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (error) {
    console.error("Restore failed:", error);
    return false;
  }
}

export async function presentPaywall(): Promise<boolean> {
  try {
    const PurchasesUI = require("react-native-purchases-ui");
    const customerInfo = await PurchasesUI.presentPaywall();
    return customerInfo?.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
}
