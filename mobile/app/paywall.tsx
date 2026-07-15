import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { PurchasesOffering, PurchasesPackage } from "react-native-purchases";

import { ShieldAPI } from "@/lib/api";
import {
  familyPackages,
  getDefaultOffering,
  hasPremium,
  purchasePackage,
  purchasesSupported,
  restorePurchases,
} from "@/lib/revenuecat";
import { useAuth, useIsPremium } from "@/state/auth";
import { colors } from "@/theme/theme";

const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const PRIVACY_URL = "https://shieldai.rushingtechnologies.com/privacy";

const BILLING_SETUP_MESSAGE =
  "Subscriptions aren't available right now — please try again in a moment.";

export default function Paywall() {
  const router = useRouter();
  const isPremium = useIsPremium();
  const userId = useAuth((s) => s.user?.id);
  const setRcPremium = useAuth((s) => s.setRcPremium);
  const refreshUser = useAuth((s) => s.refreshUser);
  const logout = useAuth((s) => s.logout);

  const [family, setFamily] = useState(false);
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

  // Family products appear here automatically once they exist in the
  // RevenueCat offering; until then the plan selector stays hidden.
  const familyPkgs = familyPackages(offering);
  const familyMonthly = familyPkgs.find((p) => p.packageType === "MONTHLY") ?? null;

  const monthlyPkg = (family ? familyMonthly : offering?.monthly) ?? null;
  const fallbackPkg = (family ? familyPkgs[0] : offering?.availablePackages[0]) ?? null;
  const selectedPkg = monthlyPkg ?? fallbackPkg;
  const hasPurchasablePackage = Boolean(selectedPkg);

  const individualMonthlyPrice = offering?.monthly?.product.priceString ?? "$4.99";
  const familyMonthlyPrice = familyMonthly?.product.priceString ?? "$9.99";

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
    if (!purchasesSupported()) return;
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

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Delete your account?",
      "This permanently removes your account, scans, recovery cases, devices, contacts, and alerts. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            try {
              await ShieldAPI.deleteAccount();
              await logout();
              router.replace("/login");
            } catch (e: any) {
              Alert.alert("Delete failed", e?.response?.data?.detail ?? "We could not delete your account right now.");
            }
          },
        },
      ]
    );
  };

  const featureRows = [
    ["AI Scan Types", true, true, true],
    ["Live Safe Browser", true, true, true],
    ["Breach Monitoring", true, true, true],
    ["Identity Theft Reports", true, true, true],
    ["Data Broker Removal", true, true, true],
    ["Family Sharing", false, true, true],
    ["Trusted Contacts", false, true, true],
    ["API Access", false, false, true],
  ] as const;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#07142C" }} contentContainerStyle={{ paddingBottom: 36 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 15 }}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={23} color={colors.text} /></Pressable>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>Subscription Tiers</Text>
          <Ionicons name="person-circle-outline" size={24} color={colors.text} />
        </View>
        <Text style={{ color: colors.text, fontSize: 21, fontWeight: "900", textAlign: "center" }}>Choose Your Protection Level</Text>
        <Text style={{ color: colors.textDim, fontSize: 11, textAlign: "center", marginTop: 4, marginBottom: 16 }}>AI-powered scam, fraud, and identity protection assistant</Text>

        <View style={{ flexDirection: "row", gap: 6 }}>
          {[
            { title: "Premium", price: individualMonthlyPrice, family: false, lines: ["Live Safe Browser", "Breach Monitoring", "Identity Breach Report", "Data Broker Exposure Checklist"] },
            { title: "Family", price: familyMonthlyPrice, family: true, lines: ["Everything in Premium", "Shared across multiple members", "Trusted Contact Escalation"] },
          ].map((tier) => {
            const selected = family === tier.family;
            return (
              <Pressable key={tier.title} onPress={() => setFamily(tier.family)} style={{ flex: 1, minHeight: 196, borderRadius: 9, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.primaryBright : "#73839A", backgroundColor: selected ? "#142E59" : "#102445", padding: 9 }}>
                <Text style={{ color: colors.text, textAlign: "center", fontSize: 12, fontWeight: "800" }}>{tier.title}</Text>
                <Text style={{ color: colors.text, textAlign: "center", fontSize: 18, fontWeight: "900", marginTop: 9 }}>{tier.price}<Text style={{ fontSize: 9, fontWeight: "400" }}>/month</Text></Text>
                <View style={{ marginTop: 10, flex: 1 }}>{tier.lines.map((line) => <Text key={line} style={{ color: colors.textDim, fontSize: 8.5, lineHeight: 13 }}>• {line}</Text>)}</View>
                <View style={{ height: 28, borderRadius: 14, backgroundColor: selected ? "#FFFFFF" : "transparent", borderWidth: 1, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}><Text style={{ color: selected ? "#0B1730" : "#FFFFFF", fontSize: 9, fontWeight: "700" }}>Select {tier.title}</Text></View>
              </Pressable>
            );
          })}
          <Pressable onPress={() => Linking.openURL("mailto:sales@rushingtechnologies.com?subject=Shield%20AI%20B2B")} style={{ flex: 1, minHeight: 196, borderRadius: 9, borderWidth: 1, borderColor: "#73839A", backgroundColor: "#102445", padding: 9 }}>
            <Text style={{ color: colors.text, textAlign: "center", fontSize: 12, fontWeight: "800" }}>B2B</Text>
            <Text style={{ color: colors.textDim, textAlign: "center", fontSize: 7 }}>(Contact Sales)</Text>
            <Text style={{ color: colors.text, textAlign: "center", fontSize: 14, fontWeight: "900", marginTop: 9 }}>Contact Sales</Text>
            <View style={{ marginTop: 12 }}><Text style={{ color: colors.textDim, fontSize: 8.5, lineHeight: 13 }}>• API, white-label workflows</Text><Text style={{ color: colors.textDim, fontSize: 8.5, lineHeight: 13 }}>• Employee anti-phishing benefits</Text></View>
          </Pressable>
        </View>

        <View style={{ borderRadius: 10, borderWidth: 1, borderColor: "#5D6F87", backgroundColor: "#102445", marginTop: 14, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#52647D" }}>
            <Text style={{ color: colors.text, fontSize: 10, fontWeight: "800", flex: 1 }}>Plan Features</Text>
            {['Premium', 'Family', 'B2B'].map((label) => <Text key={label} style={{ color: colors.text, fontSize: 8, fontWeight: "700", width: 46, textAlign: "center" }}>{label}</Text>)}
          </View>
          {featureRows.map(([label, premium, familyPlan, b2b]) => (
            <View key={label} style={{ minHeight: 27, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#263A59" }}>
              <Text style={{ color: colors.textDim, fontSize: 8.5, flex: 1 }}>{label}</Text>
              {[premium, familyPlan, b2b].map((enabled, index) => <View key={index} style={{ width: 46, alignItems: "center" }}><Ionicons name={enabled ? "checkmark-circle" : "ellipse"} size={13} color={enabled ? colors.safe : "#6D7786"} /></View>)}
            </View>
          ))}
        </View>

        {loadingOffering ? <ActivityIndicator color={colors.primaryBright} style={{ marginTop: 12 }} /> : null}
        {error ? <Text style={{ color: colors.suspicious, fontSize: 10, textAlign: "center", marginTop: 9 }}>{error}</Text> : null}
        {!loadingOffering && !error && family && !hasPurchasablePackage ? (
          <Text style={{ color: colors.suspicious, fontSize: 10, textAlign: "center", marginTop: 9 }}>
            The Family plan isn&apos;t available yet — choose Premium to get protected now.
          </Text>
        ) : null}
        <Pressable onPress={() => buy(selectedPkg)} disabled={busy !== null || !hasPurchasablePackage} style={{ height: 50, borderRadius: 25, backgroundColor: "#2458FF", alignItems: "center", justifyContent: "center", marginTop: 14, opacity: hasPurchasablePackage ? 1 : 0.55 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{busy === "purchase" ? "Starting…" : "Secure My Account"}</Text>
        </Pressable>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 14, marginTop: 12 }}>
          <Pressable onPress={restore}><Text style={{ color: colors.textMuted, fontSize: 9 }}>Restore Purchases</Text></Pressable>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)}><Text style={{ color: colors.textMuted, fontSize: 9 }}>Terms & Conditions</Text></Pressable>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}><Text style={{ color: colors.textMuted, fontSize: 9 }}>Privacy Policy</Text></Pressable>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 10 }}>
          <Pressable onPress={signOut}><Text style={{ color: colors.textMuted, fontSize: 9 }}>Sign out</Text></Pressable>
          <Pressable onPress={confirmDeleteAccount}><Text style={{ color: colors.textMuted, fontSize: 9 }}>Delete account</Text></Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
