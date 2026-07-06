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

/** Entitlement identifier attached to both subscription products. */
export const ENTITLEMENT_PREMIUM = "premium";

let configured = false;

/** True on platforms where the native Purchases module exists. */
export function purchasesSupported(): boolean {
  return Platform.OS === "ios";
}

/**
 * Configure the SDK once, identified as the backend user so RevenueCat
 * webhooks reach our API with `app_user_id` = backend user id.
 */
export async function configureRevenueCat(appUserId: string): Promise<void> {
  if (!purchasesSupported()) return;
  if (!configured) {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY, appUserID: appUserId });
    configured = true;
    return;
  }
  const currentId = await Purchases.getAppUserID();
  if (currentId !== appUserId) {
    await Purchases.logIn(appUserId);
  }
}

export async function logOutRevenueCat(): Promise<void> {
  if (!purchasesSupported() || !configured) return;
  try {
    const isAnonymous = await Purchases.isAnonymous();
    if (!isAnonymous) await Purchases.logOut();
  } catch {
    // Never block app logout on RevenueCat state.
  }
}

export function hasPremium(info: CustomerInfo | null): boolean {
  return Boolean(info?.entitlements.active[ENTITLEMENT_PREMIUM]);
}

/** Fetch entitlement state; null when unavailable (offline, unsupported platform). */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!purchasesSupported() || !configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

export async function getDefaultOffering(): Promise<PurchasesOffering | null> {
  if (!purchasesSupported() || !configured) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
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
