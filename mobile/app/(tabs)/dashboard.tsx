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
import { ProtectionRing } from "@/components/ProtectionRing";
import { ScanCard } from "@/components/ScanCard";
import { ShieldAPI } from "@/lib/api";
import { useAuth } from "@/state/auth";
import { colors, glow, radius, spacing } from "@/theme/theme";

const QUICK_SCANS: {
  type: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { type: "link",        label: "Link",        icon: "link-outline",        color: colors.primaryBright },
  { type: "image",       label: "Screenshot",  icon: "image-outline",       color: colors.teal },
  { type: "message",     label: "Message",     icon: "chatbubble-outline",  color: colors.safe },
  { type: "email",       label: "Email",       icon: "mail-outline",        color: colors.accent },
  { type: "phone",       label: "Phone",       icon: "call-outline",        color: colors.suspicious },
  { type: "marketplace", label: "Market",      icon: "storefront-outline",  color: colors.low },
  { type: "social",      label: "Social",      icon: "people-outline",      color: colors.purple },
  { type: "qr",          label: "QR Code",     icon: "qr-code-outline",     color: colors.rose },
];

const PROTECT_ITEMS: {
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
}[] = [
  { title: "Identity",      body: "Breach & credit alerts",  icon: "shield-checkmark-outline", color: colors.purple, route: "/identity" },
  { title: "Safe Browser",  body: "Pre-scan every URL",      icon: "globe-outline",            color: colors.teal,   route: "/browser" },
  { title: "Family",        body: "Protect loved ones",      icon: "people-outline",           color: colors.rose,   route: "/family" },
  { title: "Education",     body: "Spot scams faster",       icon: "book-outline",             color: colors.safe,   route: "/education" },
];

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

function QuickScanTile({
  item,
  onPress,
}: {
  item: (typeof QUICK_SCANS)[0];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: "31%",
        minWidth: 0,
        minHeight: 88,
        backgroundColor: pressed ? colors.glassActive : colors.glass,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: pressed ? `${item.color}66` : colors.borderHi,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.sm,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.md,
          backgroundColor: item.color + "22",
          alignItems: "center",
          justifyContent: "center",
          ...glow(item.color, "sm"),
        }}
      >
        <Ionicons name={item.icon} size={18} color={item.color} />
      </View>
      <Text
        style={{
          color: colors.textDim,
          fontSize: 10,
          fontWeight: "700",
          textAlign: "center",
          letterSpacing: 0.2,
        }}
        numberOfLines={2}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

function ProtectCard({
  title,
  body,
  icon,
  color,
  badge,
  onPress,
}: {
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <GlassCard accent={color} onPress={onPress} style={{ flex: 1, minWidth: 0 }}>
      <View style={{ padding: spacing.md, minHeight: 96, justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.md,
              backgroundColor: color + "22",
              alignItems: "center",
              justifyContent: "center",
              ...glow(color, "sm"),
            }}
          >
            <Ionicons name={icon} size={18} color={color} />
          </View>
          {badge != null && badge > 0 && (
            <View
              style={{
                backgroundColor: colors.critical,
                borderRadius: radius.pill,
                minWidth: 20,
                height: 20,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 5,
                ...glow(colors.critical, "sm"),
              }}
            >
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{badge}</Text>
            </View>
          )}
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: 2 }}>{title}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 15 }}>{body}</Text>
        </View>
      </View>
    </GlassCard>
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

        {/* Quick Scan */}
        <SectionLabel>QUICK SCAN</SectionLabel>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.sm,
            marginBottom: spacing.lg,
          }}
        >
          {QUICK_SCANS.map((item) => (
            <QuickScanTile
              key={item.type}
              item={item}
              onPress={() => router.push(`/(tabs)/scan?type=${item.type}` as any)}
            />
          ))}
        </View>

        {/* Protect */}
        <SectionLabel>PROTECT</SectionLabel>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm }}>
          {PROTECT_ITEMS.slice(0, 2).map((item) => (
            <ProtectCard
              key={item.title}
              {...item}
              badge={item.title === "Identity" ? unreadAlerts : undefined}
              onPress={() => router.push(item.route as any)}
            />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
          {PROTECT_ITEMS.slice(2, 4).map((item) => (
            <ProtectCard
              key={item.title}
              {...item}
              onPress={() => router.push(item.route as any)}
            />
          ))}
        </View>

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
