import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassCard } from "@/components/GlassCard";
import { GlowBackground } from "@/components/GlowBackground";
import { GradientButton } from "@/components/GradientButton";
import { ProtectionRing } from "@/components/ProtectionRing";
import { ScanCard } from "@/components/ScanCard";
import { ShieldAPI } from "@/lib/api";
import { useAuth } from "@/state/auth";
import { colors, glow, radius, spacing } from "@/theme/theme";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: colors.textMuted,
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 1.8,
        textTransform: "uppercase",
        marginBottom: spacing.sm,
      }}
    >
      {children}
    </Text>
  );
}

function StatBox({
  value,
  label,
  color = colors.primaryBright,
}: {
  value: number | string;
  label: string;
  color?: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color, fontSize: 26, fontWeight: "900", letterSpacing: -1 }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: scans, isLoading } = useQuery({
    queryKey: ["scans"],
    queryFn: ShieldAPI.listScans,
    staleTime: 30_000,
  });
  const { data: alerts } = useQuery({
    queryKey: ["identity-alerts"],
    queryFn: ShieldAPI.listIdentityAlerts,
    staleTime: 60_000,
  });

  const recentScans = scans?.slice(0, 3) ?? [];
  const todayCount =
    scans?.filter(
      (s) => new Date(s.created_at).toDateString() === new Date().toDateString()
    ).length ?? 0;
  const threatsBlocked =
    scans?.filter(
      (s) =>
        s.report && ["suspicious", "high", "critical"].includes(s.report.risk_level)
    ).length ?? 0;
  const unreadAlerts = alerts?.filter((a) => !a.is_read).length ?? 0;

  const score =
    scans && scans.length > 0
      ? Math.max(42, Math.round(100 - (threatsBlocked / scans.length) * 58))
      : 100;

  const firstName = user?.display_name?.split(" ")[0] ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GlowBackground centerY={0.22} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            {firstName ? `Hey, ${firstName} 👋` : "Welcome back 👋"}
          </Text>
          <Text
            style={{
              color: colors.text,
              fontSize: 24,
              fontWeight: "900",
              letterSpacing: -0.8,
              marginTop: 1,
            }}
          >
            Shield AI
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/profile")}
          hitSlop={12}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.glass,
            borderWidth: 1,
            borderColor: colors.borderHi,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="person-outline" size={18} color={colors.textDim} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl }}
      >
        {/* Protection ring — floats directly on the bloom, no box */}
        <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
          <ProtectionRing score={score} />
        </View>

        {/* Stats row — glass strip */}
        <GlassCard style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: "row", paddingVertical: spacing.md }}>
            <StatBox value={todayCount} label="Today" />
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <StatBox value={scans?.length ?? 0} label="Total Scans" />
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <StatBox
              value={threatsBlocked}
              label={threatsBlocked === 1 ? "Threat" : "Threats"}
              color={threatsBlocked > 0 ? colors.critical : colors.safe}
            />
          </View>
        </GlassCard>

        {/* Single primary action — everything funnels through Scan */}
        <View style={{ marginBottom: spacing.md }}>
          <GradientButton
            label="Scan Anything Suspicious"
            icon="scan"
            onPress={() => router.push("/(tabs)/scan" as any)}
          />
        </View>
        {unreadAlerts > 0 && (
          <GlassCard
            accent={colors.purple}
            onPress={() => router.push("/identity" as any)}
            style={{ marginBottom: spacing.lg }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md }}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.purple} />
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13, flex: 1 }}>
                {unreadAlerts} identity alert{unreadAlerts === 1 ? "" : "s"} need{unreadAlerts === 1 ? "s" : ""} review
              </Text>
              <Text style={{ color: colors.purple, fontWeight: "800", fontSize: 12 }}>Review →</Text>
            </View>
          </GlassCard>
        )}

        {/* Emergency Banner */}
        <Pressable
          onPress={() => router.push("/recovery")}
          style={({ pressed }) => ({
            backgroundColor: colors.criticalDim,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.critical + "50",
            padding: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            marginBottom: spacing.lg,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            ...glow(colors.critical, "sm"),
          })}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              backgroundColor: colors.critical + "22",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="alert-circle" size={22} color={colors.critical} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>
              Already been scammed?
            </Text>
            <Text style={{ color: colors.critical + "cc", fontSize: 12, marginTop: 1 }}>
              Get a step-by-step recovery plan →
            </Text>
          </View>
        </Pressable>

        {/* Recent threat feed */}
        {!isLoading && recentScans.length > 0 && (
          <>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: spacing.sm,
              }}
            >
              <SectionLabel>RECENT ACTIVITY</SectionLabel>
              <Pressable onPress={() => router.push("/(tabs)/history")}>
                <Text style={{ color: colors.primaryBright, fontSize: 12, fontWeight: "700" }}>
                  View all →
                </Text>
              </Pressable>
            </View>
            {recentScans.map((scan) => (
              <ScanCard
                key={scan.id}
                scan={scan}
                onPress={() => router.push(`/result?id=${scan.id}` as any)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
