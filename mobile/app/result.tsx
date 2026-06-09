import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { ShieldAPI } from "@/lib/api";
import { RiskBadge } from "@/components/RiskBadge";
import { colors, radius, spacing } from "@/theme/theme";

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
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: spacing.sm }}>{title}</Text>
      {children}
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      {report ? (
        <>
          <RiskBadge level={report.risk_level} score={report.risk_score} />
          <Text style={{ color: colors.textMuted, marginTop: spacing.sm }}>
            {report.threat_category} · {Math.round(report.confidence * 100)}% confidence
          </Text>

          <Section title="What we found">
            <Text style={{ color: colors.text, lineHeight: 22 }}>{report.explanation}</Text>
          </Section>

          <Section title="Red flags">
            {report.red_flags.length ? (
              report.red_flags.map((f, i) => (
                <Text key={i} style={{ color: colors.text, marginBottom: 6 }}>• {f}</Text>
              ))
            ) : (
              <Text style={{ color: colors.textMuted }}>No major red flags detected.</Text>
            )}
          </Section>

          <Section title="What to do now">
            {report.recommended_actions.map((a, i) => (
              <Text key={i} style={{ color: colors.text, marginBottom: 6 }}>→ {a}</Text>
            ))}
          </Section>

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl }}>
            <Pressable
              onPress={() => ShieldAPI.feedback(scan.id, "helpful")}
              style={{ flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: "center" }}
            >
              <Text style={{ color: colors.safe }}>👍 Helpful</Text>
            </Pressable>
            <Pressable
              onPress={() => ShieldAPI.feedback(scan.id, "false_positive")}
              style={{ flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: "center" }}
            >
              <Text style={{ color: colors.textMuted }}>Not accurate</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={{ color: colors.textMuted }}>Report is still processing…</Text>
      )}
    </ScrollView>
  );
}
