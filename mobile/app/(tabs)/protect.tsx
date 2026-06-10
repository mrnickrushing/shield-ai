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
  wide?: boolean;
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
    body: "Pre-scan a URL, inspect the destination, and only open it after the warning gate clears.",
    tag: "LIVE",
    onPress: () => {},
  },
  {
    id: "marketplace",
    icon: "storefront-outline",
    color: colors.suspicious,
    title: "Marketplace",
    body: "Catch overpayment, fake escrow, and off-platform pressure before a deal turns expensive.",
    onPress: () => {},
  },
  {
    id: "social",
    icon: "people-outline",
    color: colors.purple,
    title: "Social Scan",
    body: "Stress-test giveaways, crypto bait, and impersonation DMs before you reply.",
    onPress: () => {},
  },
  {
    id: "family",
    icon: "heart-outline",
    color: colors.rose,
    title: "Family",
    body: "Set up contacts you trust so scam recovery and alert-sharing are one tap away.",
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
}: FeatureCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: wide ? "100%" : "48%",
        height: wide ? undefined : 168,
        backgroundColor: pressed ? colors.surfaceActive : colors.surface,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        ...shadow.sm,
      })}
    >
      <View
        style={{
          backgroundColor: `${color}18`,
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

      <View style={{ padding: spacing.md, flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800", marginBottom: 4 }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17 }} numberOfLines={3}>{body}</Text>
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
            backgroundColor: colors.surface,
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
            body="Check breach exposure, review alerts, and get the exact next step when your identity posture changes."
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
            justifyContent: "space-between",
            rowGap: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
          {primaryLanes.map((lane) => (
            <FeatureCard key={lane.id} {...lane} />
          ))}
        </View>

        <SectionLabel>STAY SHARP</SectionLabel>
        <View style={{ gap: spacing.md }}>
          <FeatureCard
            icon="globe-outline"
            color={colors.accent}
            title="Community Intel"
            body="See the scam patterns people are reporting across the network so you recognize the playbook faster."
            tag="LIVE"
            onPress={() => router.push("/community")}
            wide
          />
          <FeatureCard
            icon="book-outline"
            color={colors.safe}
            title="Education Center"
            body="Short lessons that build pattern recognition, so risky requests feel wrong before they feel urgent."
            onPress={() => router.push("/education")}
            wide
          />
        </View>
      </ScrollView>
    </View>
  );
}
