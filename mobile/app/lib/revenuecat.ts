/**
 * RevenueCat configuration — single source of truth.
 *
 * The iOS API key is a *public* client key (prefix `appl_`), designed to ship
 * in the app binary. Server-side keys (prefix `sk_`) must never appear here.
 */
import { Platform } from "react-native";
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesOffering, PurchasesPackage } from "react-native-purchases";

/** RevenueCat public iOS SDK key (safe to commit). */
export const REVENUECAT_IOS_API_KEY = "appl_MySwPRnfnUCwjjdlNvYbORTDQbE";

/**
 * RevenueCat public Android SDK key — left blank until the Play Console app,
 * subscription products, and RevenueCat Play Billing integration exist (see
 * the Android parity plan). Purchases stay unsupported on Android until this
 * is filled in, so this scaffolding is a no-op until then.
 */
export const REVENUECAT_ANDROID_API_KEY = "";

/** Entitlement identifier attached to the individual subscription products. */
export const ENTITLEMENT_PREMIUM = "premium";

/** Entitlement identifier for the Family plan products (may share "premium" instead). */
export const ENTITLEMENT_FAMILY = "family";

/** Free trial length offered on all subscription products (App Store Connect config). */
export const TRIAL_DAYS = 3;

let configured = false;
let configuredAppUserId: string | null = null;

function apiKeyForPlatform(): string | null {
  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY || null;
  return null;
}

/** True on platforms where the native Purchases module exists and is configured. */
export function purchasesSupported(): boolean {
  return apiKeyForPlatform() !== null;
}

/**
 * Configure the SDK once, identified as the backend user so RevenueCat
 * webhooks reach our API with `app_user_id` = backend user id.
 */
export async function configureRevenueCat(appUserId: string): Promise<void> {
  if (!purchasesSupported()) return;
  await ensureRevenueCatConfigured(appUserId);
}

/**
 * Configure Purchases before any RevenueCat call. Offerings do not require a
 * logged-in app user, but purchases should be aliased to the backend user as
 * soon as we know it.
 */
export async function ensureRevenueCatConfigured(appUserId?: string | null): Promise<void> {
  if (!purchasesSupported()) return;
  if (!configured) {
    const apiKey = apiKeyForPlatform();
    if (!apiKey) return;
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure(
      appUserId ? { apiKey, appUserID: appUserId } : { apiKey }
    );
    configured = true;
    configuredAppUserId = appUserId ?? null;
    return;
  }

  if (!appUserId || configuredAppUserId === appUserId) return;

  const currentId = await Purchases.getAppUserID();
  if (currentId !== appUserId) {
    await Purchases.logIn(appUserId);
  }
  configuredAppUserId = appUserId;
}

export async function logOutRevenueCat(): Promise<void> {
  if (!purchasesSupported() || !configured) return;
  try {
    const isAnonymous = await Purchases.isAnonymous();
    if (!isAnonymous) await Purchases.logOut();
    configuredAppUserId = null;
  } catch {
    // Never block app logout on RevenueCat state.
  }
}

export function hasPremium(info: CustomerInfo | null): boolean {
  return Boolean(
    info?.entitlements.active[ENTITLEMENT_PREMIUM] ||
    info?.entitlements.active[ENTITLEMENT_FAMILY]
  );
}

/**
 * Family packages inside an offering, identified by "family" in the package
 * identifier or product id. Empty until the Family products exist in
 * RevenueCat, at which point the paywall's plan selector lights up on its own.
 */
export function familyPackages(offering: PurchasesOffering | null): PurchasesPackage[] {
  if (!offering) return [];
  return offering.availablePackages.filter((p) => {
    const id = `${p.identifier} ${p.product.identifier}`.toLowerCase();
    return id.includes("family");
  });
}

/** Fetch entitlement state; null when unavailable (offline, unsupported platform). */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!purchasesSupported()) return null;
  await ensureRevenueCatConfigured(configuredAppUserId);
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

export async function getDefaultOffering(appUserId?: string | null): Promise<PurchasesOffering | null> {
  if (!purchasesSupported()) return null;
  await ensureRevenueCatConfigured(appUserId);
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? Object.values(offerings.all)[0] ?? null;
}

export function addCustomerInfoListener(listener: (info: CustomerInfo) => void): void {
  if (!purchasesSupported()) return;
  Purchases.addCustomerInfoUpdateListener(listener);
}

/** Returns customer info after purchase, or null when the user cancelled. */
export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (e: any) {
    if (e?.userCancelled) return null;
    throw e;
  }
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}
