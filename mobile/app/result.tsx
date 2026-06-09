import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from "react-native";

import { ShieldAPI } from "@/lib/api";
import { RiskBadge } from "@/components/RiskBadge";
import { colors, radius, spacing } from "@/theme/theme";

const RISK_TINT: Record<string, string> = {
  safe: colors.safe,
  low: colors.low,
  suspicious: colors.suspicious,
  high: colors.high,
  critical: colors.critical,
};

export default function Result() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: scan, isLoading } = useQuery({
    queryKey: ["scan", id],
    queryFn: () => ShieldAPI.getScan(id!),
    enabled: !!id,
  });

  if (isLoading || !scan) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primaryBright} />
      </View>
    );
  }

  const report = scan.report;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700", marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 11, color: colors.textMuted }}>{title}</Text>
      {children}
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}>
      {report ? (
        <>
          {/* Risk verdict hero */}
          <View style={{ backgroundColor: (RISK_TINT[report.risk_level] ?? colors.primary) + "12", paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg }}>
            <RiskBadge level={report.risk_level} score={report.risk_score} large />
            <Text style={{ color: colors.textMuted, marginTop: spacing.sm, fontSize: 13 }}>
              {report.threat_category} · {Math.round(report.confidence * 100)}% confidence
            </Text>
          </View>

          <View style={{ padding: spacing.lg }}>
            <Section title="What we found">
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg }}>
                <Text style={{ color: colors.text, lineHeight: 23, fontSize: 15 }}>{report.explanation}</Text>
              </View>
            </Section>

            <Section title="Red flags">
              {report.red_flags.length ? (
                <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: 10 }}>
                  {report.red_flags.map((f, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: spacing.sm }}>
                      <Text style={{ color: colors.critical, fontWeight: "900", fontSize: 14 }}>•</Text>
                      <Text style={{ color: colors.text, fontSize: 14, flex: 1, lineHeight: 21 }}>{f}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: colors.textMuted }}>No major red flags detected.</Text>
              )}
            </Section>

            <Section title="What to do now">
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: 10 }}>
                {report.recommended_actions.map((a, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Text style={{ color: colors.primaryBright, fontWeight: "900", fontSize: 14 }}>→</Text>
                    <Text style={{ color: colors.text, fontSize: 14, flex: 1, lineHeight: 21 }}>{a}</Text>
                  </View>
                ))}
              </View>
            </Section>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl }}>
              <Pressable
                onPress={() => ShieldAPI.feedback(scan.id, "helpful")}
                style={{ flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.safe + "22", borderWidth: 1, borderColor: colors.safe + "44", alignItems: "center" }}
              >
                <Text style={{ color: colors.safe, fontWeight: "700" }}>👍  Helpful</Text>
              </Pressable>
              <Pressable
                onPress={() => ShieldAPI.feedback(scan.id, "false_positive")}
                style={{ flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}
              >
                <Text style={{ color: colors.textMuted, fontWeight: "600" }}>Not accurate</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                const text = [
                  "Shield AI Risk Report",
                  `Risk: ${report.risk_level.toUpperCase()} (${report.risk_score}/100)`,
                  `Category: ${report.threat_category}`,
                  "",
                  report.explanation,
                  "",
                  report.red_flags.length ? `Red flags:\n${report.red_flags.map((f) => `• ${f}`).join("\n")}` : "",
                  "",
                  `Recommended actions:\n${report.recommended_actions.map((a) => `→ ${a}`).join("\n")}`,
                ].filter(Boolean).join("\n");
                Share.share({ message: text, title: "Shield AI Risk Report" });
              }}
              style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm, flexDirection: "row", justifyContent: "center", gap: spacing.sm }}
            >
              <Ionicons name="share-outline" size={18} color={colors.primaryBright} />
              <Text style={{ color: colors.primaryBright, fontWeight: "700" }}>Share Report</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={{ padding: spacing.lg }}>
          <Text style={{ color: colors.textMuted }}>Report is still processing…</Text>
        </View>
      )}
    </ScrollView>
  );
}
