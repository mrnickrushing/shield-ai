import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { ScanCard } from "@/components/ScanCard";
import { ShieldAPI } from "@/lib/api";
import { useAuth } from "@/state/auth";
import { colors, radius, spacing } from "@/theme/theme";

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const { data: scans, isLoading } = useQuery({
    queryKey: ["scans"],
    queryFn: ShieldAPI.listScans,
    staleTime: 30_000,
  });

  const recentScans = scans?.slice(0, 3) ?? [];
  const todayCount =
    scans?.filter((s) => {
      const d = new Date(s.created_at);
      return d.toDateString() === new Date().toDateString();
    }).length ?? 0;

  const ActionCard = ({
    icon,
    title,
    body,
    onPress,
  }: {
    icon: string;
    title: string;
    body: string;
    onPress: () => void;
  }) => (
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
      })}
    >
      <Text style={{ fontSize: 28 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700", marginBottom: 3 }}>
          {title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{body}</Text>
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: spacing.lg,
        }}
      >
        <View>
          <Text style={{ color: colors.textMuted, marginBottom: 2 }}>
            Welcome back{user?.display_name ? `, ${user.display_name}` : ""}
          </Text>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: "800" }}>Is it real?</Text>
        </View>
        {todayCount > 0 && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: spacing.sm,
              alignItems: "center",
              minWidth: 52,
            }}
          >
            <Text style={{ color: colors.primaryBright, fontWeight: "800", fontSize: 20 }}>
              {todayCount}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>today</Text>
          </View>
        )}
      </View>

      {/* Action cards */}
      <ActionCard
        icon="🔗"
        title="Check a Link"
        body="Paste any suspicious URL — get a risk report in seconds."
        onPress={() => router.push("/(tabs)/scan?type=link")}
      />
      <ActionCard
        icon="📷"
        title="Scan a Screenshot"
        body="Upload a screenshot of a message, email, or website."
        onPress={() => router.push("/(tabs)/scan?type=image")}
      />

      {/* Recent scans */}
      {isLoading ? (
        <ActivityIndicator color={colors.primaryBright} style={{ marginTop: spacing.xl }} />
      ) : recentScans.length > 0 ? (
        <>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: spacing.lg,
              marginBottom: spacing.sm,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
              Recent Scans
            </Text>
            <Pressable onPress={() => router.push("/(tabs)/history")}>
              <Text style={{ color: colors.primaryBright, fontSize: 13 }}>View all →</Text>
            </Pressable>
          </View>
          {recentScans.map((scan) => (
            <ScanCard
              key={scan.id}
              scan={scan}
              onPress={() => router.push(`/result?id=${scan.id}`)}
            />
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}
