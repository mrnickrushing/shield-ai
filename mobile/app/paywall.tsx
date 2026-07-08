import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { PurchasesOffering, PurchasesPackage } from "react-native-purchases";

import { Button, Eyebrow, FadeIn, GlowOrb, Surface } from "@/components/ui";
import {
  getDefaultOffering,
  hasPremium,
  purchasePackage,
  purchasesSupported,
  restorePurchases,
  TRIAL_DAYS,
} from "@/lib/revenuecat";
import { useAuth, useIsPremium } from "@/state/auth";
import { colors, gradients, radius, spacing, withAlpha } from "@/theme/theme";

const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const PRIVACY_URL = "https://shieldai.rushingtechnologies.com/privacy";

const OUTCOMES = [
  "5,576 scam numbers blocked before they ring",
  "Every link, screenshot, and text checked before you act",
  "Dangerous sites stopped before they load — not after",
  "Know the moment your email or password leaks, not after",
  "A weekly report of exactly what got blocked, for you",
  "Guided removal from 16 data-broker sites",
  "Family alerts shared the second something looks wrong",
];

const BILLING_SETUP_MESSAGE =
  "Subscriptions aren't available right now — please try again in a moment.";

export default function Paywall() {
  const router = useRouter();
  const isPremium = useIsPremium();
  const userId = useAuth((s) => s.user?.id);
  const setRcPremium = useAuth((s) => s.setRcPremium);
  const refreshUser = useAuth((s) => s.refreshUser);
  const logout = useAuth((s) => s.logout);

  const [annual, setAnnual] = useState(true);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(true);
  const [busy, setBusy] = useState<"purchase" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOffering = useCallback(async () => {
    setLoadingOffering(true);
    setError(null);
    try {
      const nextOffering = await getDefaultOffering(userId);
      setOffering(nextOffering);
      if (!nextOffering || nextOffering.availablePackages.length === 0) {
        setError(BILLING_SETUP_MESSAGE);
      }
    } catch (e) {
      if (__DEV__) console.warn("Failed to load RevenueCat offerings", e);
      setOffering(null);
      setError(BILLING_SETUP_MESSAGE);
    } finally {
      setLoadingOffering(false);
    }
  }, [userId]);

  useEffect(() => {
    loadOffering();
  }, [loadOffering]);

  // Entitlement can arrive from a purchase, a restore, or the backend webhook.
  useEffect(() => {
    if (isPremium) router.replace("/(tabs)/dashboard");
  }, [isPremium, router]);

  const monthlyPkg = offering?.monthly ?? null;
  const annualPkg = offering?.annual ?? null;
  const fallbackPkg = offering?.availablePackages[0] ?? null;
  const selectedPkg = annual ? annualPkg ?? fallbackPkg : monthlyPkg ?? fallbackPkg;
  const hasPurchasablePackage = Boolean(selectedPkg);

  const monthlyPrice = monthlyPkg?.product.priceString ?? "$4.99";
  const annualPrice = annualPkg?.product.priceString ?? "$35.99";
  const annualPerMonth = annualPkg ? `${(annualPkg.product.price / 12).toFixed(2)}` : "3.00";

  const finishIfPremium = async (info: Awaited<ReturnType<typeof purchasePackage>>) => {
    if (!info || !hasPremium(info)) return false;
    setRcPremium(true);
    // user.is_premium on the backend is set by an async RevenueCat webhook, which
    // can lag a few seconds behind the purchase. Poll briefly so the scan/identity/
    // monitoring endpoints (gated on the server-side flag) don't 402 a user who
    // just paid. If it doesn't land in time we still continue — screens that hit a
    // 402 route back here rather than dead-ending.
    for (let attempt = 0; attempt < 8; attempt++) {
      await refreshUser();
      if (useAuth.getState().user?.is_premium) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    router.replace("/(tabs)/dashboard");
    return true;
  };

  const buy = async (pkg: PurchasesPackage | null) => {
    if (!pkg) return;
    setError(null);
    setBusy("purchase");
    try {
      const info = await purchasePackage(pkg); // null = user cancelled
      if (info && !(await finishIfPremium(info))) {
        setError("Purchase completed but the subscription isn't active yet. Try Restore Purchases in a moment.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Purchase failed. You haven't been charged.");
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setError(null);
    setBusy("restore");
    try {
      const info = await restorePurchases();
      if (!(await finishIfPremium(info))) {
        setError("No active subscription found for this Apple ID.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Restore failed. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 64 }}>
      <FadeIn>
        <View style={{ alignItems: "center", paddingVertical: spacing.xl, position: "relative" }}>
          <GlowOrb color={colors.low} size={220} opacity={0.3} style={{ top: -20 }} />
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: withAlpha(colors.low, "22"), alignItems: "center", justifyContent: "center", marginBottom: spacing.md, borderWidth: 2, borderColor: withAlpha(colors.low, "44") }}>
            <Ionicons name="star" size={36} color={colors.low} />
          </View>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.8, textAlign: "center" }}>Turn on Shield AI</Text>
          <Text style={{ color: colors.textMuted, fontSize: 15, textAlign: "center", marginTop: 8, lineHeight: 22 }}>
            Start your {TRIAL_DAYS}-day free trial —{"\n"}protection starts the moment you do.
          </Text>
        </View>
      </FadeIn>

      {!purchasesSupported() ? (
        <Surface style={{ marginBottom: spacing.lg }}>
          <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: "center" }}>
            Subscriptions are managed through the App Store and are available on iPhone.
          </Text>
        </Surface>
      ) : loadingOffering ? (
        <Surface style={{ marginBottom: spacing.lg, alignItems: "center", paddingVertical: spacing.xl }}>
          <ActivityIndicator color={colors.primaryBright} />
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: spacing.sm }}>Loading plans…</Text>
        </Surface>
      ) : !offering || offering.availablePackages.length === 0 ? (
        <Surface style={{ marginBottom: spacing.lg, alignItems: "center" }}>
          <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: "center", marginBottom: spacing.md }}>
            Premium subscription options aren&apos;t available right now.
          </Text>
          <Button label="Try Again" variant="secondary" onPress={loadOffering} />
        </Surface>
      ) : (
        <>
          {/* Billing toggle */}
          <FadeIn delay={60}>
            <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.lg, padding: 4, marginBottom: spacing.lg }}>
              <Pressable onPress={() => setAnnual(false)} style={{ flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: !annual ? colors.primary : "transparent", alignItems: "center" }}>
                <Text style={{ color: !annual ? "#fff" : colors.textMuted, fontWeight: "700" }}>Monthly</Text>
              </Pressable>
              <Pressable onPress={() => setAnnual(true)} style={{ flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: annual ? colors.primary : "transparent", alignItems: "center" }}>
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  <Text style={{ color: annual ? "#fff" : colors.textMuted, fontWeight: "700" }}>Annual</Text>
                  {annual && (
                    <View style={{ backgroundColor: colors.safe, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ color: "#000", fontSize: 10, fontWeight: "800" }}>SAVE 40%</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            </View>
          </FadeIn>

          {/* Price hero */}
          <FadeIn delay={100}>
            <Surface accent={colors.primaryBright} glow={withAlpha(colors.primary, "30")} style={{ alignItems: "center", marginBottom: spacing.lg }}>
              <Text style={{ color: colors.primaryBright, fontSize: 48, fontWeight: "900", letterSpacing: -1 }}>
                {annual ? annualPrice : monthlyPrice}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                {annual ? `per year · ~${annualPerMonth}/month` : "per month"}
              </Text>
              <Text style={{ color: colors.safe, fontSize: 13, fontWeight: "700", marginTop: 4 }}>{TRIAL_DAYS}-day free trial included</Text>
            </Surface>
          </FadeIn>
        </>
      )}

      {/* Outcomes */}
      <FadeIn delay={140}>
        <Eyebrow style={{ marginBottom: spacing.sm }}>WHAT PROTECTION LOOKS LIKE</Eyebrow>
        <Surface accent={colors.purple} style={{ marginBottom: spacing.lg, gap: spacing.sm }}>
          {OUTCOMES.map((f) => (
            <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Ionicons name="checkmark-circle" size={20} color={colors.safe} />
              <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{f}</Text>
            </View>
          ))}
        </Surface>
      </FadeIn>

      {error && (
        <View style={{ backgroundColor: withAlpha(colors.suspicious, "18"), borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
          <Text style={{ color: colors.textMuted, textAlign: "center", fontSize: 13 }}>{error}</Text>
        </View>
      )}

      {/* CTA */}
      <FadeIn delay={200}>
        <Button
          label={busy === "purchase" ? "Starting…" : "Start Free Trial →"}
          onPress={() => buy(selectedPkg)}
          loading={busy === "purchase"}
          disabled={busy !== null || !hasPurchasablePackage}
          gradient={gradients.primary}
          style={{ marginBottom: spacing.sm }}
        />
        <Text style={{ color: colors.primaryBright, fontSize: 12, marginBottom: spacing.md, textAlign: "center" }}>
          {hasPurchasablePackage ? `Cancel anytime · No charge for ${TRIAL_DAYS} days` : "Subscriptions aren't available right now"}
        </Text>

        <Pressable onPress={restore} disabled={busy !== null} style={{ padding: spacing.sm, alignItems: "center" }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
            {busy === "restore" ? "Restoring…" : "Restore Purchases"}
          </Text>
        </Pressable>

        <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.lg, marginTop: spacing.sm }}>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={{ color: colors.textMuted, fontSize: 12, textDecorationLine: "underline" }}>Terms of Use</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={{ color: colors.textMuted, fontSize: 12, textDecorationLine: "underline" }}>Privacy Policy</Text>
          </Pressable>
        </View>

        <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: spacing.md }}>
          Subscription auto-renews after the trial. Cancel anytime in Settings.
        </Text>

        <Pressable onPress={signOut} style={{ padding: spacing.md, alignItems: "center", marginTop: spacing.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Sign out</Text>
        </Pressable>
      </FadeIn>
    </ScrollView>
  );
}
