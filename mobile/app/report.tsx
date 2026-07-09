import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect } from "react";
import { ActivityIndicator, ScrollView, Share, Text, View } from "react-native";

import { Button, Eyebrow, FadeIn, Surface } from "@/components/ui";
import { recordWinAndMaybeAskForReview } from "@/lib/appReview";
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

function shareMessage(report: Record<string, number>): string {
  const highlights = [
    report.threats_caught > 0 && `caught ${report.threats_caught} threat${report.threats_caught === 1 ? "" : "s"}`,
    report.sites_blocked > 0 && `blocked ${report.sites_blocked} dangerous site${report.sites_blocked === 1 ? "" : "s"}`,
    report.texts_junked > 0 && `filtered ${report.texts_junked} scam text${report.texts_junked === 1 ? "" : "s"}`,
    report.calls_labeled > 0 && `labeled ${report.calls_labeled} scam number${report.calls_labeled === 1 ? "" : "s"}`,
  ].filter(Boolean);
  const summary = highlights.length
    ? `Shield AI ${highlights.join(", ")} for me this week.`
    : "Shield AI is watching my calls, texts, and links for scams.";
  return `${summary} Before you click. Before you pay. Before you trust.\nhttps://shieldai.rushingtechnologies.com`;
}

export default function WeeklyReportScreen() {
  const { data: report, isLoading, isError } = useQuery({
    queryKey: ["weekly-report"],
    queryFn: ShieldAPI.weeklyReport,
    staleTime: 5 * 60_000,
  });

  // A threat-filled weekly report is a win moment — eligible (rarely) for the
  // system rating prompt.
  const threatsCaught = report?.threats_caught ?? 0;
  useEffect(() => {
    if (threatsCaught <= 0) return;
    // One win per calendar week, however many times the report is opened.
    const weekBucket = Math.floor(Date.now() / (7 * 86_400_000));
    const timer = setTimeout(() => { recordWinAndMaybeAskForReview(`weekly:${weekBucket}`); }, 3000);
    return () => clearTimeout(timer);
  }, [threatsCaught]);

  const shareReport = () => {
    if (!report) return;
    Share.share({ message: shareMessage(report as unknown as Record<string, number>) }).catch(() => {});
  };

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

          <FadeIn delay={320}>
            <Button
              label="Share My Report"
              icon="share-outline"
              onPress={shareReport}
              variant="secondary"
              style={{ marginTop: spacing.lg }}
            />
          </FadeIn>

          <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: spacing.lg }}>
            Delivered weekly as a push notification. Manage in Notifications settings.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
