import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from "react-native";

import { ShieldAPI, type Scan } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

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
        width: "48%",
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: `${accent}33`,
      }}
    >
      <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{value}</Text>
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
        borderColor: `${accent}22`,
        marginBottom: spacing.sm,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: `${accent}22`,
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
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.xl,
            alignItems: "center",
          }}
        >
          <ActivityIndicator color={colors.primaryBright} size="large" />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", marginTop: spacing.lg, marginBottom: spacing.sm }}>
            Building your verdict
          </Text>
          <Text style={{ color: colors.textMuted, textAlign: "center", lineHeight: 22, marginBottom: spacing.lg }}>
            We are still collecting evidence and generating next-step guidance. This screen refreshes automatically.
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={{
              backgroundColor: colors.primaryBright,
              borderRadius: radius.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
            }}
          >
            <Text style={{ color: "#08111f", fontWeight: "800" }}>
              {isRefetching ? "Refreshing..." : "Refresh now"}
            </Text>
          </Pressable>
        </View>
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
            onPress: () => router.push(`/browser?url=${encodeURIComponent(targetUrl)}&trusted=1`),
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
        <View
          style={{
            position: "absolute",
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: `${accent}18`,
            top: -70,
            right: -60,
          }}
        />
        <Text style={{ color: accent, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, marginBottom: spacing.sm }}>
          VERDICT
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View
            style={{
              width: 104,
              height: 104,
              borderRadius: 52,
              borderWidth: 6,
              borderColor: `${accent}66`,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: `${accent}12`,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1 }}>
              {report.risk_score}
            </Text>
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

      <View style={{ padding: spacing.lg }}>
        <View
          style={{
            backgroundColor: `${accent}14`,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: `${accent}33`,
            padding: spacing.lg,
            marginTop: -spacing.lg,
            marginBottom: spacing.lg,
          }}
        >
          <Text style={{ color: accent, fontSize: 11, fontWeight: "800", letterSpacing: 1.1, marginBottom: 6 }}>
            DO THIS FIRST
          </Text>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18, marginBottom: spacing.sm }}>
            {report.recommended_actions[0] ?? "Review the recommendations before taking action."}
          </Text>
          <Pressable
            onPress={primaryAction.onPress}
            style={{
              backgroundColor: accent,
              borderRadius: radius.md,
              padding: spacing.md,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: spacing.sm,
            }}
          >
            <Ionicons name={primaryAction.icon} size={18} color="#08111f" />
            <Text style={{ color: "#08111f", fontWeight: "900", fontSize: 15 }}>
              {primaryAction.label}
            </Text>
          </Pressable>
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: spacing.sm }}>
            Why we think this
          </Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.text, lineHeight: 23, fontSize: 15 }}>{report.explanation}</Text>
          </View>
        </View>

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

        {report.red_flags.length > 0 ? (
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
                  borderColor: `${accent}22`,
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
        ) : null}

        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: spacing.sm }}>
            Next safest moves
          </Text>
          {report.recommended_actions.map((step, index) => (
            <NumberedStep key={`${step}-${index}`} index={index} text={step} accent={accent} />
          ))}
        </View>

        {scan.raw_input ? (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: spacing.sm }}>
              Source preview
            </Text>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
              }}
            >
              <Text style={{ color: colors.textMuted, lineHeight: 21, fontSize: 13 }}>
                {scan.raw_input.slice(0, 320)}
                {scan.raw_input.length > 320 ? "..." : ""}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm }}>
          <Pressable
            onPress={() => ShieldAPI.feedback(scan.id, "helpful")}
            style={{
              flex: 1,
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: `${colors.safe}1f`,
              borderWidth: 1,
              borderColor: `${colors.safe}33`,
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
      </View>
    </ScrollView>
  );
}
