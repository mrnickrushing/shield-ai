import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { ShieldAPI } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

const boostColor = (boost: number) => {
  if (boost >= 40) return colors.critical;
  if (boost >= 25) return colors.high;
  if (boost >= 10) return colors.suspicious;
  return colors.low;
};

export default function CommunityScreen() {
  const router = useRouter();
  const { data: patterns, isLoading } = useQuery({
    queryKey: ["community-patterns"],
    queryFn: ShieldAPI.listPublicPatterns,
    staleTime: 300_000,
  });
  const { data: myReports } = useQuery({
    queryKey: ["my-reports"],
    queryFn: ShieldAPI.listMyReports,
    staleTime: 60_000,
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5, marginBottom: 4 }}>Community Intel</Text>
      <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.lg }}>Active scam patterns identified across the Shield AI network.</Text>

      {/* Report CTA */}
      <Pressable
        onPress={() => router.push("/share")}
        style={{ backgroundColor: colors.primary + "22", borderColor: colors.primary + "44", borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl }}
      >
        <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primary + "33", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="flag-outline" size={20} color={colors.primaryBright} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>Report a Scam</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Help others by reporting what you encountered</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>

      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: spacing.sm }}>Active Threat Patterns</Text>

      {isLoading ? (
        <ActivityIndicator color={colors.primaryBright} style={{ marginTop: spacing.xl }} />
      ) : (patterns ?? []).length === 0 ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center" }}>
          <Ionicons name="shield-outline" size={40} color={colors.textMuted} style={{ marginBottom: spacing.md }} />
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>No patterns yet</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: 4 }}>Be the first to report a scam and help the community.</Text>
        </View>
      ) : (
        (patterns ?? []).map((p: any) => (
          <View key={p.id} style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15, flex: 1, letterSpacing: -0.2 }}>{p.name}</Text>
              <View style={{ backgroundColor: boostColor(p.risk_score_boost) + "22", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginLeft: spacing.sm }}>
                <Text style={{ color: boostColor(p.risk_score_boost), fontSize: 11, fontWeight: "800" }}>+{p.risk_score_boost} risk</Text>
              </View>
            </View>
            {!!p.description && (
              <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 8 }}>{p.description}</Text>
            )}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ backgroundColor: colors.primaryDim, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: colors.primaryBright, fontSize: 11, fontWeight: "700" }}>{p.category}</Text>
              </View>
              <View style={{ backgroundColor: colors.surface, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>{p.pattern_type}</Text>
              </View>
            </View>
          </View>
        ))
      )}

      {(myReports ?? []).length > 0 && (
        <>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginTop: spacing.xl, marginBottom: spacing.sm }}>Your Reports</Text>
          {(myReports ?? []).map((r: any) => (
            <View key={r.id} style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>{r.report_type.replace(/_/g, " ")}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{r.category || "No category"} · {r.status}</Text>
              </View>
              <View style={{ backgroundColor: r.status === "approved" ? colors.safe + "22" : colors.surface, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: r.status === "approved" ? colors.safe + "44" : colors.border }}>
                <Text style={{ color: r.status === "approved" ? colors.safe : colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>{r.status}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}
