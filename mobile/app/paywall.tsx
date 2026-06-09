import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors, radius, spacing } from "@/theme/theme";

const FREE_FEATURES = [
  "5 scans per day",
  "Link, QR, and screenshot scans",
  "Basic risk reports",
  "Education lessons",
];

const PREMIUM_FEATURES = [
  "Unlimited scans — every type",
  "Identity breach monitoring",
  "Family alert sharing",
  "Priority AI analysis",
  "Scam recovery wizard",
  "Community scam intelligence",
  "Biometric app lock",
  "Weekly threat digest",
];

export default function Paywall() {
  const router = useRouter();
  const [annual, setAnnual] = useState(true);

  const monthlyPrice = annual ? "2.99" : "4.99";
  const annualTotal = "35.99";

  const done = () => router.replace("/(tabs)/dashboard");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 64 }}>

      <View style={{ alignItems: "center", paddingVertical: spacing.xl }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.low + "22", alignItems: "center", justifyContent: "center", marginBottom: spacing.md, borderWidth: 2, borderColor: colors.low + "44" }}>
          <Ionicons name="star" size={36} color={colors.low} />
        </View>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.8, textAlign: "center" }}>Shield AI Premium</Text>
        <Text style={{ color: colors.textMuted, fontSize: 15, textAlign: "center", marginTop: 8, lineHeight: 22 }}>
          Full protection, unlimited scans,{"\n"}and everything to keep you safe.
        </Text>
      </View>

      {/* Billing toggle */}
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

      {/* Price hero */}
      <View style={{ backgroundColor: colors.primary + "22", borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.primary + "44" }}>
        <Text style={{ color: colors.primaryBright, fontSize: 48, fontWeight: "900", letterSpacing: -1 }}>${monthlyPrice}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>per month{annual ? ` · $${annualTotal}/year` : ""}</Text>
        <Text style={{ color: colors.safe, fontSize: 13, fontWeight: "700", marginTop: 4 }}>7-day free trial included</Text>
      </View>

      {/* Premium features */}
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: spacing.sm }}>Premium includes</Text>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm }}>
        {PREMIUM_FEATURES.map((f) => (
          <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="checkmark-circle" size={20} color={colors.safe} />
            <Text style={{ color: colors.text, fontSize: 15 }}>{f}</Text>
          </View>
        ))}
      </View>

      {/* Free tier */}
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: spacing.sm }}>Free tier</Text>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xl, gap: spacing.sm }}>
        {FREE_FEATURES.map((f) => (
          <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: 15 }}>{f}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <Pressable style={{ backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", marginBottom: spacing.md }} onPress={done}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}>Start Free Trial →</Text>
        <Text style={{ color: colors.primaryBright, fontSize: 12, marginTop: 3 }}>Cancel anytime · No charge for 7 days</Text>
      </Pressable>

      <Pressable onPress={done} style={{ padding: spacing.md, alignItems: "center" }}>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>Continue with Free</Text>
      </Pressable>

      <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: spacing.sm }}>
        Subscription auto-renews. Cancel anytime in Settings.
      </Text>
    </ScrollView>
  );
}
