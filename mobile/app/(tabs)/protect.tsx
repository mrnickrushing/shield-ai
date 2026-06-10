import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ShieldAPI } from "@/lib/api";
import { colors, radius, shadow, spacing } from "@/theme/theme";

type FeatureCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  body: string;
  badge?: number;
  tag?: string;
  onPress: () => void;
  wide?: boolean;
};

function FeatureCard({ icon, color, title, body, badge, tag, onPress, wide }: FeatureCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: wide ? undefined : 1,
        flexBasis: wide ? undefined : 0,
        minWidth: 0,
        backgroundColor: pressed ? colors.surfaceActive : colors.surface,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        ...shadow.sm,
      })}
    >
      {/* Colored top band */}
      <View
        style={{
          backgroundColor: color + "18",
          borderBottomWidth: 1,
          borderBottomColor: color + "30",
          padding: spacing.md,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            backgroundColor: color + "28",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center" }}>
          {tag && (
            <View
              style={{
                backgroundColor: color + "22",
                borderRadius: radius.pill,
                paddingHorizontal: spacing.sm,
                paddingVertical: 3,
              }}
            >
              <Text style={{ color, fontSize: 10, fontWeight: "800" }}>{tag}</Text>
            </View>
          )}
          {badge != null && badge > 0 && (
            <View
              style={{
                backgroundColor: colors.critical,
                borderRadius: radius.pill,
                minWidth: 22,
                height: 22,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 6,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{badge}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </View>
      </View>

      {/* Content */}
      <View style={{ padding: spacing.md }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800", marginBottom: 3 }}>
          {title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17 }}>{body}</Text>
      </View>
    </Pressable>
  );
}

export default function ProtectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: alerts } = useQuery({
    queryKey: ["identity-alerts"],
    queryFn: () => ShieldAPI.listIdentityAlerts(),
    staleTime: 60_000,
  });

  const unreadAlerts = alerts?.filter((a) => !a.is_read).length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 22,
            fontWeight: "900",
            letterSpacing: -0.7,
          }}
        >
          Protect
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
          Proactive tools to guard your identity and money.
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
      >
        {/* Identity — full width with badge */}
        <FeatureCard
          icon="shield-checkmark-outline"
          color={colors.primaryBright}
          title="Identity Protection"
          body="Check if your email appeared in a data breach and get credit freeze guidance."
          badge={unreadAlerts}
          onPress={() => router.push("/identity")}
          wide
        />

        {/* 2-col: Browser + Marketplace */}
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <FeatureCard
            icon="globe-outline"
            color={colors.teal}
            title="Safe Browser"
            body="Pre-scan URLs before opening them."
            onPress={() => router.push("/browser")}
          />
          <FeatureCard
            icon="storefront-outline"
            color={colors.suspicious}
            title="Marketplace"
            body="Detect overpayment and fake escrow."
            onPress={() => router.push("/(tabs)/scan?type=marketplace" as any)}
          />
        </View>

        {/* 2-col: Social + Family */}
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <FeatureCard
            icon="people-outline"
            color={colors.purple}
            title="Social Scan"
            body="Spot fake giveaways and impersonation."
            onPress={() => router.push("/(tabs)/scan?type=social" as any)}
          />
          <FeatureCard
            icon="heart-outline"
            color={colors.rose}
            title="Family"
            body="Add contacts to share scam alerts."
            onPress={() => router.push("/family")}
          />
        </View>

        {/* Community — full width */}
        <FeatureCard
          icon="globe-outline"
          color={colors.accent}
          title="Community Intel"
          body="Browse trending scam patterns reported across the Shield AI network."
          tag="LIVE"
          onPress={() => router.push("/community")}
          wide
        />

        {/* Education — full width */}
        <FeatureCard
          icon="book-outline"
          color={colors.safe}
          title="Education Center"
          body="Short lessons to help you spot scams before they happen. Level up your scam radar."
          onPress={() => router.push("/education")}
          wide
        />
      </ScrollView>
    </View>
  );
}
