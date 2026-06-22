import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from "react-native";

import { AnimatedNumber, Button, Eyebrow, FadeIn, GlowOrb, Surface } from "@/components/ui";
import { ShieldAPI, type Scan } from "@/lib/api";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";

const RISK_TINT: Record<string, string> = {
  safe: colors.safe,
  low: colors.low,
  suspicious: colors.suspicious,
  high: colors.high,
  critical: colors.critical,
};

function SignalTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: "48%",
        minWidth: 0,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: withAlpha(accent, "33"),
      }}
    >
      <Eyebrow style={{ marginBottom: 4 }}>{label}</Eyebrow>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

function NumberedStep({
  index,
  text,
  accent,
}: {
  index: number;
  text: string;
  accent: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: withAlpha(accent, "22"),
        marginBottom: spacing.sm,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: withAlpha(accent, "22"),
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        <Text style={{ color: accent, fontWeight: "900" }}>{index + 1}</Text>
      </View>
      <Text style={{ color: colors.text, flex: 1, lineHeight: 21, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

function buildEvidenceHighlights(scan: Scan) {
  const report = scan.report;
  if (!report) return [];

  const evidence = (report.evidence ?? {}) as Record<string, any>;
  const urlEvidence = typeof evidence.url === "object" && evidence.url ? evidence.url : evidence;
  const highlights: { label: string; value: string }[] = [
    { label: "Threat Class", value: report.threat_category },
    { label: "Red Flags", value: String(report.red_flags.length) },
  ];

  if (typeof urlEvidence.domain === "string" && urlEvidence.domain) {
    highlights.push({ label: "Domain", value: urlEvidence.domain });
  }
  if (typeof urlEvidence.redirect_count === "number" && urlEvidence.redirect_count > 0) {
    highlights.push({ label: "Redirects", value: String(urlEvidence.redirect_count) });
  }
  if (urlEvidence.safe_browsing_hit) {
    highlights.push({ label: "Google Signal", value: "Flagged" });
  }
  if (typeof urlEvidence.domain_age_days === "number") {
    highlights.push({ label: "Domain Age", value: `${urlEvidence.domain_age_days} days` });
  }
  const brands = Array.isArray(evidence.detected_brands) ? evidence.detected_brands : undefined;
  if (brands?.length) {
    highlights.push({ label: "Brand Cues", value: brands.slice(0, 2).join(", ") });
  }

  return highlights.slice(0, 6);
}

function extractTargetUrl(scan: Scan) {
  const evidence = (scan.report?.evidence ?? {}) as Record<string, any>;
  const urlEvidence = typeof evidence.url === "object" && evidence.url ? evidence.url : evidence;
  const candidates = [
    urlEvidence.final_url,
    urlEvidence.normalized_url,
    urlEvidence.original_url,
    scan.raw_input,
  ];

  return candidates.find((value) => typeof value === "string" && /^https?:\/\//i.test(value)) as string | undefined;
}

export default function Result() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: scan, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["scan", id],
    queryFn: () => ShieldAPI.getScan(id!),
    enabled: !!id,
    refetchInterval: (query) => (query.state.data?.report ? false : 2500),
  });

  if (isLoading || !scan) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.primaryBright} size="large" />
      </View>
    );
  }

  const report = scan.report;
  if (!report) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: "center" }}>
        <Surface style={{ alignItems: "center", paddingVertical: spacing.xl }}>
          <ActivityIndicator color={colors.primaryBright} size="large" />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", marginTop: spacing.lg, marginBottom: spacing.sm }}>
            Building your verdict
          </Text>
          <Text style={{ color: colors.textMuted, textAlign: "center", lineHeight: 22, marginBottom: spacing.lg }}>
            We are still collecting evidence and generating next-step guidance. This screen refreshes automatically.
          </Text>
          <Button
            label={isRefetching ? "Refreshing..." : "Refresh now"}
            onPress={() => refetch()}
            loading={isRefetching}
            style={{ width: "100%" }}
          />
        </Surface>
      </View>
    );
  }

  const accent = RISK_TINT[report.risk_level] ?? colors.primaryBright;
  const evidenceHighlights = buildEvidenceHighlights(scan);
  const targetUrl = extractTargetUrl(scan);
  const primaryAction =
    report.risk_level === "high" || report.risk_level === "critical"
      ? {
          label: "Start Recovery Plan",
          icon: "medical-outline" as const,
          onPress: () => router.push(`/recovery?scanId=${scan.id}`),
        }
      : (scan.scan_type === "link" || scan.scan_type === "qr") && targetUrl
        ? {
            label: "Open In Safe Browser",
            icon: "globe-outline" as const,
            onPress: () => router.push(`/browser?url=${encodeURIComponent(targetUrl)}`),
          }
        : {
            label: "Analyze Something Else",
            icon: "scan-outline" as const,
            onPress: () => router.push("/(tabs)/scan"),
          };

  const summaryTitle =
    report.risk_level === "critical" || report.risk_level === "high"
      ? "This needs a defensive response now."
      : report.risk_level === "suspicious"
        ? "This deserves caution before you continue."
        : "No major threat signal dominated this scan.";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <FadeIn>
        <View
          style={{
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xl,
            paddingBottom: spacing.xl,
            overflow: "hidden",
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
          }}
        >
          <GlowOrb color={accent} size={240} opacity={0.32} style={{ top: -80, right: -60 }} />
          <Eyebrow style={{ color: accent, marginBottom: spacing.sm }}>VERDICT</Eyebrow>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 104,
                height: 104,
                borderRadius: 52,
                borderWidth: 6,
                borderColor: withAlpha(accent, "66"),
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(accent, "12"),
              }}
            >
              <AnimatedNumber
                value={report.risk_score}
                style={{ color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1 }}
              />
              <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "700" }}>RISK</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -1 }}>
                {report.risk_level.toUpperCase()}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>
                {summaryTitle}
              </Text>
              <Text style={{ color: accent, fontSize: 13, fontWeight: "700", marginTop: spacing.sm }}>
                {report.threat_category} • {Math.round(report.confidence * 100)}% confidence
              </Text>
            </View>
          </View>
        </View>
      </FadeIn>

      <View style={{ padding: spacing.lg }}>
        <FadeIn delay={60}>
          <View
            style={{
              backgroundColor: withAlpha(accent, "14"),
              borderRadius: 22,
              borderWidth: 1,
              borderColor: withAlpha(accent, "33"),
              padding: spacing.lg,
              marginTop: -spacing.lg,
              marginBottom: spacing.lg,
            }}
          >
            <Eyebrow style={{ color: accent, marginBottom: 6 }}>DO THIS FIRST</Eyebrow>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18, marginBottom: spacing.sm }}>
              {report.recommended_actions[0] ?? "Review the recommendations before taking action."}
            </Text>
            <Button
              label={primaryAction.label}
              icon={primaryAction.icon}
              onPress={primaryAction.onPress}
              gradient={[accent, accent]}
            />
          </View>
        </FadeIn>

        <FadeIn delay={100}>
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: spacing.sm }}>
              Why we think this
            </Text>
            <Surface>
              <Text style={{ color: colors.text, lineHeight: 23, fontSize: 15 }}>{report.explanation}</Text>
            </Surface>
          </View>
        </FadeIn>

        <FadeIn delay={140}>
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: spacing.sm }}>
              Evidence snapshot
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.sm }}>
              <SignalTile label="Risk Level" value={report.risk_level.toUpperCase()} accent={accent} />
              <SignalTile label="Confidence" value={`${Math.round(report.confidence * 100)}%`} accent={accent} />
              {evidenceHighlights.map((item) => (
                <SignalTile key={`${item.label}-${item.value}`} label={item.label} value={item.value} accent={accent} />
              ))}
            </View>
          </View>
        </FadeIn>

        {report.red_flags.length > 0 ? (
          <FadeIn delay={180}>
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: spacing.sm }}>
                Red flags detected
              </Text>
              {report.red_flags.map((flag, index) => (
                <View
                  key={`${flag}-${index}`}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: withAlpha(accent, "22"),
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                    flexDirection: "row",
                    gap: spacing.sm,
                  }}
                >
                  <Ionicons name="alert-circle-outline" size={18} color={accent} style={{ marginTop: 1 }} />
                  <Text style={{ color: colors.text, flex: 1, lineHeight: 21, fontSize: 14 }}>{flag}</Text>
                </View>
              ))}
            </View>
          </FadeIn>
        ) : null}

        <FadeIn delay={220}>
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: spacing.sm }}>
              Next safest moves
            </Text>
            {report.recommended_actions.map((step, index) => (
              <NumberedStep key={`${step}-${index}`} index={index} text={step} accent={accent} />
            ))}
          </View>
        </FadeIn>

        {scan.raw_input ? (
          <FadeIn delay={260}>
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: spacing.sm }}>
                Source preview
              </Text>
              <Surface>
                <Text style={{ color: colors.textMuted, lineHeight: 21, fontSize: 13 }}>
                  {scan.raw_input.slice(0, 320)}
                  {scan.raw_input.length > 320 ? "..." : ""}
                </Text>
              </Surface>
            </View>
          </FadeIn>
        ) : null}

        <FadeIn delay={300}>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm }}>
            <Pressable
              onPress={() => ShieldAPI.feedback(scan.id, "helpful")}
              style={{
                flex: 1,
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: withAlpha(colors.safe, "1f"),
                borderWidth: 1,
                borderColor: withAlpha(colors.safe, "33"),
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.safe, fontWeight: "800" }}>Helpful</Text>
            </Pressable>
            <Pressable
              onPress={() => ShieldAPI.feedback(scan.id, "false_positive")}
              style={{
                flex: 1,
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.textMuted, fontWeight: "700" }}>Not accurate</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => {
              const text = [
                "Shield AI Risk Report",
                `Risk: ${report.risk_level.toUpperCase()} (${report.risk_score}/100)`,
                `Category: ${report.threat_category}`,
                `Confidence: ${Math.round(report.confidence * 100)}%`,
                "",
                report.explanation,
                "",
                report.red_flags.length ? `Red flags:\n${report.red_flags.map((flag) => `• ${flag}`).join("\n")}` : "",
                "",
                `Recommended actions:\n${report.recommended_actions.map((action, index) => `${index + 1}. ${action}`).join("\n")}`,
              ]
                .filter(Boolean)
                .join("\n");
              Share.share({ message: text, title: "Shield AI Risk Report" });
            }}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: spacing.md,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              justifyContent: "center",
              gap: spacing.sm,
            }}
          >
            <Ionicons name="share-outline" size={18} color={colors.primaryBright} />
            <Text style={{ color: colors.primaryBright, fontWeight: "800" }}>Share Report</Text>
          </Pressable>
        </FadeIn>
      </View>
    </ScrollView>
  );
}
