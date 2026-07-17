import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { Eyebrow, FadeIn, Surface } from "@/components/ui";
import { ShieldAPI, type ProtectionScoreComponent } from "@/lib/api";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";

// Icon + one-line "how to earn it" for each score component, keyed to the
// backend's component keys.
const META: Record<string, { icon: keyof typeof Ionicons.glyphMap; how: string }> = {
  scanned_recently: { icon: "scan-outline", how: "Scan anything suspicious to stay sharp." },
  call_protection: { icon: "call-outline", how: "Sync the blocklist on the Call & Text Protection screen." },
  text_protection: { icon: "chatbubble-outline", how: "Turn on SMS filtering, then sync your protection." },
  safe_browser_used: { icon: "globe-outline", how: "Open a link through the Safe Browser once." },
  identity_monitored: { icon: "shield-outline", how: "Add an email, phone, or domain to monitor for breaches." },
  education_started: { icon: "school-outline", how: "Finish one 2-minute scam-spotting lesson." },
  premium_active: { icon: "star-outline", how: "Keep your subscription active." },
};

function Row({ c, onPress }: { c: ProtectionScoreComponent; onPress: () => void }) {
  const meta = META[c.key];
  const tint = c.earned ? colors.safe : colors.suspicious;
  return (
    <Pressable
      onPress={c.earned ? undefined : onPress}
      disabled={c.earned}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingVertical: spacing.sm,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: withAlpha(tint, "22"),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={meta?.icon ?? "ellipse-outline"} size={20} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{c.title}</Text>
        {!c.earned && meta ? (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{meta.how}</Text>
        ) : null}
      </View>
      {c.earned ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.safe} />
      ) : (
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: colors.suspicious, fontWeight: "800", fontSize: 13 }}>+{c.points}</Text>
          <Text style={{ color: colors.suspicious, fontSize: 11, fontWeight: "700" }}>Set up →</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function ProtectionChecklistScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["protection-score"],
    queryFn: ShieldAPI.protectionScore,
    staleTime: 30_000,
  });

  const components = data?.components ?? [];
  const earnedCount = components.filter((c) => c.earned).length;
  // Unearned first (sorted by impact), then earned — the actionable stuff leads.
  const ordered = [...components].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? 1 : -1;
    return b.points - a.points;
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <FadeIn>
        <Eyebrow style={{ marginBottom: spacing.xs }}>YOUR PROTECTION</Eyebrow>
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.6, marginBottom: spacing.sm }}>
          Ways to raise your score
        </Text>
      </FadeIn>

      {isLoading ? (
        <View style={{ paddingVertical: spacing.xxl, alignItems: "center" }}>
          <ActivityIndicator color={colors.primaryBright} />
        </View>
      ) : isError || !data ? (
        <FadeIn delay={40}>
          <Surface accent={colors.suspicious} style={{ alignItems: "center", marginTop: spacing.lg }}>
            <Ionicons name="cloud-offline-outline" size={34} color={colors.suspicious} />
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 17, marginTop: spacing.sm }}>Protection status unavailable</Text>
            <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.md }}>
              Shield AI could not load your current protections. No score or “fully protected” status has been assumed.
            </Text>
            <Pressable accessibilityRole="button" onPress={() => refetch()} style={{ minHeight: 44, paddingHorizontal: spacing.lg, justifyContent: "center", borderRadius: radius.pill, backgroundColor: withAlpha(colors.primaryBright, "22") }}>
              <Text style={{ color: colors.primaryBright, fontWeight: "800" }}>{isFetching ? "Retrying…" : "Try Again"}</Text>
            </Pressable>
          </Surface>
        </FadeIn>
      ) : (
        <>
          <FadeIn delay={40}>
            <Surface accent={colors.primaryBright} glow={withAlpha(colors.primary, "30")} style={{ marginBottom: spacing.lg }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
                <Text style={{ color: colors.text, fontSize: 40, fontWeight: "900", letterSpacing: -1.5 }}>
                  {data.score}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: "700" }}>/ 100</Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
                {earnedCount} of {components.length} protections active
                {earnedCount < components.length ? " — tap any item below to finish setup." : " — you're fully protected."}
              </Text>
            </Surface>
          </FadeIn>

          <FadeIn delay={80}>
            <Surface>
              {ordered.map((c, i) => (
                <View key={c.key}>
                  {i > 0 ? <View style={{ height: 1, backgroundColor: colors.border }} /> : null}
                  <Row c={c} onPress={() => router.push(`/${c.screen}` as any)} />
                </View>
              ))}
            </Surface>
          </FadeIn>
        </>
      )}
    </ScrollView>
  );
}
