import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { ScanCard } from "@/components/ScanCard";
import { ShieldAPI } from "@/lib/api";
import { useAuth } from "@/state/auth";
import { colors, radius, shadow, spacing } from "@/theme/theme";

type ActionCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  body: string;
  onPress: () => void;
};

function ActionCard({ icon, iconColor = colors.primaryBright, title, body, onPress }: ActionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceActive : colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        ...shadow.sm,
      })}
    >
      <View style={{ width: 42, height: 42, borderRadius: radius.md, backgroundColor: iconColor + "22", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: 3, letterSpacing: -0.2 }}>{title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>{body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

function StatPill({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, alignItems: "center", borderColor: colors.border, borderWidth: 1 }}>
      <Text style={{ color: colors.primaryBright, fontWeight: "900", fontSize: 22, letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: scans, isLoading } = useQuery({ queryKey: ["scans"], queryFn: ShieldAPI.listScans, staleTime: 30_000 });
  const recentScans = scans?.slice(0, 3) ?? [];
  const todayCount = scans?.filter((s) => new Date(s.created_at).toDateString() === new Date().toDateString()).length ?? 0;
  const threatsBlocked = scans?.filter((s) => s.report && ["suspicious", "high", "critical"].includes(s.report.risk_level)).length ?? 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>

      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.lg }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 2 }}>
            Welcome back{user?.display_name ? `, ${user.display_name}` : ""}
          </Text>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.8 }}>Is it real?</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>Scan anything suspicious in seconds.</Text>
        </View>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryDim, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.primary + "44" }}>
          <Ionicons name="shield-checkmark" size={24} color={colors.primaryBright} />
        </View>
      </View>

      {/* Stats strip */}
      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xl }}>
        <StatPill value={todayCount} label="Today" />
        <StatPill value={scans?.length ?? 0} label="Total scans" />
        <StatPill value={threatsBlocked} label="Threats caught" />
      </View>

      {/* Analyze section */}
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: spacing.sm }}>Analyze</Text>
      <ActionCard icon="link-outline" iconColor={colors.primaryBright} title="Check a Link" body="Paste any suspicious URL — get a risk report in seconds." onPress={() => router.push("/(tabs)/scan?type=link")} />
      <ActionCard icon="image-outline" iconColor={colors.safe} title="Scan a Screenshot" body="Upload a screenshot of a message, email, or website." onPress={() => router.push("/(tabs)/scan?type=image")} />

      {/* Protect section */}
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: spacing.sm, marginTop: spacing.sm }}>Protect</Text>
      <ActionCard icon="alert-circle-outline" iconColor={colors.critical} title="Scam Recovery" body="Already been scammed? Get a guided step-by-step recovery plan." onPress={() => router.push("/recovery")} />
      <ActionCard icon="book-outline" iconColor={colors.suspicious} title="Education Center" body="Short lessons to help you spot scams before they happen." onPress={() => router.push("/education")} />
      <ActionCard icon="people-outline" iconColor={colors.low} title="Family Protection" body="Add trusted contacts to share scam alerts with." onPress={() => router.push("/family")} />

      {/* Recent scans */}
      {isLoading ? (
        <ActivityIndicator color={colors.primaryBright} style={{ marginTop: spacing.xl }} />
      ) : recentScans.length > 0 ? (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg, marginBottom: spacing.sm }}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>Recent Scans</Text>
            <Pressable onPress={() => router.push("/(tabs)/history")}>
              <Text style={{ color: colors.primaryBright, fontSize: 13 }}>View all →</Text>
            </Pressable>
          </View>
          {recentScans.map((scan) => <ScanCard key={scan.id} scan={scan} onPress={() => router.push(`/result?id=${scan.id}`)} />)}
        </>
      ) : null}
    </ScrollView>
  );
}
