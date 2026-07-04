import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlowBackground } from "@/components/GlowBackground";
import { ShieldAPI } from "@/lib/api";
import { colors, glow, radius, spacing } from "@/theme/theme";

type FeatureCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  body: string;
  badge?: number;
  tag?: string;
  wide?: boolean;
  compact?: boolean;
  onPress: () => void;
};

type ProtectLane = FeatureCardProps & {
  id: string;
};

const PRIMARY_LANES: ProtectLane[] = [
  {
    id: "browser",
    icon: "globe-outline",
    color: colors.teal,
    title: "Safe Browser",
    body: "Pre-scan a link, inspect the destination, and open it only after the gate clears.",
    tag: "LIVE",
    onPress: () => {},
  },
  {
    id: "marketplace",
    icon: "storefront-outline",
    color: colors.suspicious,
    title: "Marketplace",
    body: "Catch overpayment, fake escrow, and off-platform pressure before a deal goes bad.",
    onPress: () => {},
  },
  {
    id: "social",
    icon: "people-outline",
    color: colors.purple,
    title: "Social Scan",
    body: "Pressure-test giveaways, crypto bait, and impersonation DMs before you reply.",
    onPress: () => {},
  },
  {
    id: "family",
    icon: "heart-outline",
    color: colors.rose,
    title: "Family",
    body: "Set up trusted contacts so recovery help and alert-sharing stay one tap away.",
    onPress: () => {},
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: colors.textDim,
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1.2,
        marginBottom: spacing.sm,
      }}
    >
      {children}
    </Text>
  );
}

function FeatureCard({
  icon,
  color,
  title,
  body,
  badge,
  tag,
  onPress,
  wide,
  compact,
}: FeatureCardProps) {
  const bodyLines = wide ? 2 : 3;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: "100%",
        height: wide ? 144 : 168,
        backgroundColor: pressed ? colors.glassActive : colors.glassDeep,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: `${color}35`,
        overflow: "hidden",
        alignSelf: compact ? "stretch" : undefined,
        transform: [{ scale: pressed ? 0.97 : 1 }],
        ...glow(color, "sm"),
      })}
    >
      {/* Accent top-edge glow line */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: radius.xl,
          right: radius.xl,
          height: 2,
          borderRadius: 1,
          backgroundColor: color,
          opacity: 0.85,
          zIndex: 1,
          ...glow(color, "sm"),
        }}
      />
      <View
        style={{
          backgroundColor: `${color}14`,
          borderBottomWidth: 1,
          borderBottomColor: `${color}30`,
          padding: spacing.md,
          height: 68,
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
            backgroundColor: `${color}28`,
            alignItems: "center",
            justifyContent: "center",
            ...glow(color, "sm"),
          }}
        >
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, flexShrink: 1 }}>
          {tag ? (
            <View
              style={{
                backgroundColor: `${color}22`,
                borderRadius: radius.pill,
                paddingHorizontal: spacing.sm,
                paddingVertical: 3,
              }}
            >
              <Text style={{ color, fontSize: 10, fontWeight: "800" }} numberOfLines={1}>
                {tag}
              </Text>
            </View>
          ) : null}
          {badge != null && badge > 0 ? (
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
          ) : null}
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </View>
      </View>

      <View style={{ padding: spacing.md, flex: 1, justifyContent: "space-between" }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800", marginBottom: 4 }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17 }} numberOfLines={bodyLines}>
          {body}
        </Text>
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

  const unreadAlerts = alerts?.filter((alert) => !alert.is_read).length ?? 0;

  const primaryLanes = PRIMARY_LANES.map((lane) => {
    switch (lane.id) {
      case "browser":
        return { ...lane, onPress: () => router.push("/browser") };
      case "marketplace":
        return { ...lane, onPress: () => router.push("/(tabs)/scan?type=marketplace" as any) };
      case "social":
        return { ...lane, onPress: () => router.push("/(tabs)/scan?type=social" as any) };
      case "family":
        return { ...lane, onPress: () => router.push("/family") };
      default:
        return lane;
    }
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GlowBackground centerY={0.1} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
        }}
      >
        <View
          style={{
            backgroundColor: colors.glassDeep,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: `${colors.primaryBright}33`,
            padding: spacing.lg,
            overflow: "hidden",
            marginBottom: spacing.lg,
          }}
        >
          <View
            style={{
              position: "absolute",
              width: 190,
              height: 190,
              borderRadius: 95,
              backgroundColor: `${colors.primaryBright}14`,
              top: -60,
              right: -45,
            }}
          />
          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: `${colors.primaryBright}1f`,
              borderRadius: radius.pill,
              paddingHorizontal: spacing.sm,
              paddingVertical: 6,
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ color: colors.primaryBright, fontSize: 12, fontWeight: "800", letterSpacing: 1 }}>
              DEFENSE GRID
            </Text>
          </View>

          <Text style={{ color: colors.text, fontSize: 29, fontWeight: "900", letterSpacing: -1, marginBottom: 8 }}>
            Put a buffer between you and the next scam.
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 22, marginBottom: spacing.lg }}>
            These tools are your proactive layer: inspect risky links, protect family, monitor identity exposure, and sharpen your scam radar before pressure hits.
          </Text>

          <View
            style={{
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: `${colors.primaryBright}2a`,
              borderRadius: radius.lg,
              padding: spacing.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 6 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: `${colors.primaryBright}22`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="shield-half-outline" size={18} color={colors.primaryBright} />
              </View>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", flex: 1 }}>
                Your response tools are ready.
              </Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>
              {unreadAlerts > 0
                ? `You currently have ${unreadAlerts} unread identity alert${unreadAlerts === 1 ? "" : "s"}. Start there, then harden the rest of your routine.`
                : "No unread identity alerts right now. This is the place to pressure-test risky situations before they turn into cleanup work."}
            </Text>
          </View>
        </View>

        <SectionLabel>START HERE</SectionLabel>
        <View style={{ marginBottom: spacing.lg }}>
          <FeatureCard
            icon="shield-checkmark-outline"
            color={colors.primaryBright}
            title="Identity Protection"
            body="Check breach exposure, review alerts, and get the next move when your identity posture changes."
            badge={unreadAlerts}
            tag={unreadAlerts > 0 ? "NEEDS REVIEW" : "MONITORING"}
            onPress={() => router.push("/identity")}
            wide
          />
        </View>

        <SectionLabel>PROACTIVE TOOLS</SectionLabel>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            marginHorizontal: -6,
            marginBottom: spacing.lg,
          }}
        >
          {primaryLanes.map((lane) => (
            <View
              key={lane.id}
              style={{
                width: "50%",
                paddingHorizontal: 6,
                marginBottom: spacing.md,
              }}
            >
              <FeatureCard {...lane} compact />
            </View>
          ))}
        </View>

        <SectionLabel>STAY SHARP</SectionLabel>
        <View style={{ gap: spacing.md }}>
          <FeatureCard
            icon="globe-outline"
            color={colors.accent}
            title="Community Intel"
            body="See the scam patterns people are reporting so you recognize the playbook faster."
            tag="LIVE"
            onPress={() => router.push("/community")}
            wide
          />
          <FeatureCard
            icon="book-outline"
            color={colors.safe}
            title="Education Center"
            body="Short lessons that build pattern recognition before risky requests start feeling urgent."
            onPress={() => router.push("/education")}
            wide
          />
        </View>
      </ScrollView>
    </View>
  );
}
