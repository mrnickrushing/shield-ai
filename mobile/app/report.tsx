import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Eyebrow, FadeIn, Surface } from "@/components/ui";
import { ShieldAPI } from "@/lib/api";
import { colors, spacing, withAlpha } from "@/theme/theme";

type StatDef = {
  key: "threats_caught" | "sites_blocked" | "texts_junked" | "calls_labeled" | "scans_total" | "new_breach_alerts";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const STATS: StatDef[] = [
  { key: "threats_caught", label: "Threats caught", icon: "shield-checkmark", color: colors.critical },
  { key: "sites_blocked", label: "Dangerous sites blocked", icon: "globe", color: colors.high },
  { key: "texts_junked", label: "Scam texts filtered", icon: "chatbubble-ellipses", color: colors.suspicious },
  { key: "calls_labeled", label: "Scam numbers labeled", icon: "call", color: colors.purple },
  { key: "scans_total", label: "Scans you ran", icon: "scan", color: colors.primaryBright },
  { key: "new_breach_alerts", label: "New breach alerts", icon: "key", color: colors.teal },
];

export default function WeeklyReportScreen() {
  const { data: report, isLoading, isError } = useQuery({
    queryKey: ["weekly-report"],
    queryFn: ShieldAPI.weeklyReport,
    staleTime: 5 * 60_000,
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <FadeIn>
        <Eyebrow style={{ marginBottom: spacing.xs }}>LAST 7 DAYS</Eyebrow>
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.6, marginBottom: spacing.sm }}>
          Protection Report
        </Text>
      </FadeIn>

      {isLoading && (
        <View style={{ paddingVertical: spacing.xxl, alignItems: "center" }}>
          <ActivityIndicator color={colors.primaryBright} />
        </View>
      )}
      {isError && (
        <Surface style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: "center" }}>
            Couldn&apos;t load your report. Check your connection and try again.
          </Text>
        </Surface>
      )}

      {report && (
        <>
          <FadeIn delay={40}>
            <Surface accent={colors.primaryBright} glow={withAlpha(colors.primary, "30")} style={{ marginBottom: spacing.lg }}>
              <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{report.summary}</Text>
            </Surface>
          </FadeIn>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {STATS.map((s, i) => (
              <FadeIn key={s.key} delay={60 + i * 40} style={{ flexBasis: "48%", flexGrow: 1 }}>
                <Surface style={{ alignItems: "flex-start", gap: spacing.xs }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: withAlpha(s.color, "22"),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name={s.icon} size={17} color={s.color} />
                  </View>
                  <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -1 }}>
                    {report[s.key]}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{s.label}</Text>
                </Surface>
              </FadeIn>
            ))}
          </View>

          <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: spacing.lg }}>
            Delivered weekly as a push notification. Manage in Notifications settings.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
