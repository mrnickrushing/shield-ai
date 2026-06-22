import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProtectionRing } from "@/components/ProtectionRing";
import { ScanCard } from "@/components/ScanCard";
import { AnimatedNumber, Button, Eyebrow, FadeIn, GlowOrb, PulseIcon, Surface } from "@/components/ui";
import { ShieldAPI } from "@/lib/api";
import { useAuth } from "@/state/auth";
import { colors, gradients, radius, spacing, withAlpha } from "@/theme/theme";

const QUICK_SCANS: Array<{
  type: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}> = [
  { type: "link",        label: "Link",        icon: "link-outline",        color: colors.primaryBright },
  { type: "image",       label: "Screenshot",  icon: "image-outline",       color: colors.teal },
  { type: "message",     label: "Message",     icon: "chatbubble-outline",  color: colors.safe },
  { type: "email",       label: "Email",       icon: "mail-outline",        color: colors.accent },
  { type: "phone",       label: "Phone",       icon: "call-outline",        color: colors.suspicious },
  { type: "marketplace", label: "Market",      icon: "storefront-outline",  color: colors.low },
  { type: "social",      label: "Social",      icon: "people-outline",      color: colors.purple },
  { type: "qr",          label: "QR Code",     icon: "qr-code-outline",     color: colors.rose },
];

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
        backgroundColor: pressed ? colors.surfaceActive : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.sm,
      })}
    >
      {({ pressed }) => (
        <>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: radius.md,
              backgroundColor: withAlpha(item.color, "22"),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PulseIcon name={item.icon} size={18} color={item.color} pressed={pressed} />
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
        </>
      )}
    </Pressable>
  );
}

function StatBox({
  value,
  label,
  color = colors.primaryBright,
}: {
  value: number;
  label: string;
  color?: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <AnimatedNumber value={value} style={{ color, fontSize: 26, fontWeight: "900", letterSpacing: -1 }} />
      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

function IconButton({
  icon,
  onPress,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  badge?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {({ pressed }) => (
        <>
          <PulseIcon name={icon} size={18} color={colors.textDim} pressed={pressed} />
          {badge ? (
            <View
              style={{
                position: "absolute",
                top: 7,
                right: 8,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.critical,
                borderWidth: 1.5,
                borderColor: colors.surface,
              }}
            />
          ) : null}
        </>
      )}
    </Pressable>
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
  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => ShieldAPI.listNotifications(),
    staleTime: 30_000,
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
  const unreadNotifications = notifications?.filter((n) => !n.is_read).length ?? 0;

  const score =
    scans && scans.length > 0
      ? Math.max(42, Math.round(100 - (threatsBlocked / scans.length) * 58))
      : 100;

  const firstName = user?.display_name?.split(" ")[0] ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
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
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <IconButton
            icon="notifications-outline"
            badge={unreadNotifications > 0}
            onPress={() => router.push("/notifications")}
          />
          <IconButton icon="person-outline" onPress={() => router.push("/profile")} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl }}
      >
        {/* Protection Score Card */}
        <FadeIn>
          <Surface accent={colors.primaryBright} glow={withAlpha(colors.primary, "30")} style={{ alignItems: "center", marginBottom: spacing.lg, position: "relative" }}>
            <GlowOrb color={colors.primary} size={260} opacity={0.22} style={{ top: -90, left: -40 }} />
            <Eyebrow style={{ marginBottom: spacing.lg }}>PROTECTION SCORE</Eyebrow>

            <ProtectionRing score={score} />

            <View
              style={{
                height: 1,
                backgroundColor: colors.border,
                width: "100%",
                marginTop: spacing.lg,
                marginBottom: spacing.lg,
              }}
            />

            <View style={{ flexDirection: "row", width: "100%" }}>
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
          </Surface>
        </FadeIn>

        {/* Quick Scan */}
        <FadeIn delay={60}>
          <Eyebrow style={{ marginBottom: spacing.sm }}>QUICK SCAN</Eyebrow>
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
        </FadeIn>

        {/* Single Protect CTA — the Protect tab is the authoritative hub now,
            so this links out instead of duplicating its cards. */}
        <FadeIn delay={100}>
          <Pressable
            onPress={() => router.push("/(tabs)/protect")}
            style={({ pressed }) => ({
              borderRadius: radius.xl,
              overflow: "hidden",
              marginBottom: spacing.lg,
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <View
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: withAlpha(colors.purple, "33"),
                borderRadius: radius.xl,
                padding: spacing.lg,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <GlowOrb color={colors.purple} size={160} opacity={0.3} style={{ top: -50, right: -30 }} />
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: radius.md,
                  backgroundColor: withAlpha(colors.purple, "22"),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="lock-closed-outline" size={22} color={colors.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
                  Your protection toolkit
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>
                  Identity, family, browser, education{unreadAlerts > 0 ? ` · ${unreadAlerts} unread` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </Pressable>
        </FadeIn>

        {/* Emergency Banner */}
        <FadeIn delay={140}>
          <Pressable
            onPress={() => router.push("/recovery")}
            style={({ pressed }) => ({
              backgroundColor: colors.criticalDim,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: withAlpha(colors.critical, "40"),
              padding: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              marginBottom: spacing.lg,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: withAlpha(colors.critical, "22"),
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
              <Text style={{ color: withAlpha(colors.critical, "cc"), fontSize: 12, marginTop: 1 }}>
                Get a step-by-step recovery plan →
              </Text>
            </View>
          </Pressable>
        </FadeIn>

        {/* Recent Scans */}
        {!isLoading && recentScans.length > 0 && (
          <FadeIn delay={180}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: spacing.sm,
              }}
            >
              <Eyebrow>RECENT ACTIVITY</Eyebrow>
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
          </FadeIn>
        )}

        {!isLoading && recentScans.length === 0 && (
          <FadeIn delay={180}>
            <Surface style={{ alignItems: "center", paddingVertical: spacing.xl }}>
              <Ionicons name="shield-checkmark-outline" size={32} color={colors.textMuted} />
              <Text style={{ color: colors.text, fontWeight: "700", marginTop: spacing.sm }}>
                No scans yet
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: "center" }}>
                Run your first scan above to see your protection score grow.
              </Text>
              <Button
                label="Start a Scan"
                icon="scan-outline"
                gradient={gradients.primary}
                onPress={() => router.push("/(tabs)/scan")}
                style={{ marginTop: spacing.lg, width: "100%" }}
              />
            </Surface>
          </FadeIn>
        )}
      </ScrollView>
    </View>
  );
}
