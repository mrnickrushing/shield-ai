import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlowBackground } from "@/components/GlowBackground";
import { GradientButton } from "@/components/GradientButton";
import { recordWinAndMaybeAskForReview } from "@/lib/appReview";
import { ShieldAPI, type Scan } from "@/lib/api";
import { colors, glow, gradients, radius, riskColors, spacing } from "@/theme/theme";

const RISK_TINT: Record<string, string> = riskColors;

// Per-verdict background bloom colors, per the design deck (green aurora vs red pulse).
const VERDICT_BLOOM: Record<string, string> = {
  safe: "#052010",
  low: "#0a1a06",
  suspicious: "#1c1204",
  high: "#1c0d03",
  critical: "#1a0205",
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
        backgroundColor: colors.glassDeep,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: `${accent}33`,
      }}
    >
      <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </Text>
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
        backgroundColor: colors.glassDeep,
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
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [feedbackMode, setFeedbackMode] = useState<"helpful" | "not_accurate" | null>(null);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [correctedContext, setCorrectedContext] = useState("");
  const [feedbackEvidence, setFeedbackEvidence] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [pollingTimeout, setPollingTimeout] = useState<{ id?: string; timedOut: boolean }>({ id, timedOut: false });
  const pollingTimedOut = pollingTimeout.id === id && pollingTimeout.timedOut;
  useEffect(() => {
    const timer = setTimeout(() => setPollingTimeout({ id, timedOut: true }), 120_000);
    return () => clearTimeout(timer);
  }, [id]);
  const { data: scan, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["scan", id],
    queryFn: () => ShieldAPI.getScan(id!),
    enabled: !!id,
    refetchInterval: (query) => (
      query.state.data?.report || query.state.data?.status === "failed" || pollingTimedOut
        ? false
        : 2500
    ),
  });

  // A high-risk verdict is a "we just caught this for you" moment — the right
  // time to (rarely) ask for a rating. Delayed so it never covers the verdict.
  const verdictLevel = scan?.report?.risk_level;
  const scanId = scan?.id;
  useEffect(() => {
    if (!scanId || (verdictLevel !== "high" && verdictLevel !== "critical")) return;
    const timer = setTimeout(() => { recordWinAndMaybeAskForReview(`scan:${scanId}`); }, 3000);
    return () => clearTimeout(timer);
  }, [verdictLevel, scanId]);

  if (!id || isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: "center", alignItems: "center" }}>
        <Ionicons name="cloud-offline-outline" size={44} color={colors.suspicious} />
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900", marginTop: spacing.md }}>Report unavailable</Text>
        <Text style={{ color: colors.textMuted, textAlign: "center", lineHeight: 21, marginVertical: spacing.md }}>
          {id ? "We couldn't load this report. Check your connection and try again." : "This report link is invalid or incomplete."}
        </Text>
        {id ? <GradientButton label="Try Again" onPress={() => refetch()} /> : null}
      </View>
    );
  }

  if (isLoading || !scan) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.primaryBright} size="large" />
      </View>
    );
  }

  const report = scan.report;
  if (!report) {
    const failed = scan.status === "failed";
    const delayed = pollingTimedOut;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: "center" }}>
        <View
          style={{
            backgroundColor: colors.glassDeep,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.xl,
            alignItems: "center",
          }}
        >
          {failed ? (
            <Ionicons name="alert-circle-outline" size={46} color={colors.critical} />
          ) : delayed ? (
            <Ionicons name="time-outline" size={46} color={colors.suspicious} />
          ) : (
            <ActivityIndicator color={colors.primaryBright} size="large" />
          )}
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", marginTop: spacing.lg, marginBottom: spacing.sm }}>
            {failed ? "Analysis couldn't finish" : delayed ? "Analysis is taking longer" : "Building your verdict"}
          </Text>
          <Text style={{ color: colors.textMuted, textAlign: "center", lineHeight: 22, marginBottom: spacing.lg }}>
            {failed
              ? "No verdict was produced, so we won't guess. Return to the scanner and try again."
              : delayed
                ? "The automatic wait has stopped. You can safely leave this screen and check again later."
                : "We are still collecting evidence and generating next-step guidance. This screen refreshes automatically."}
          </Text>
          <Pressable
            onPress={() => failed ? router.replace("/(tabs)/scan") : refetch()}
            style={{
              backgroundColor: colors.primaryBright,
              borderRadius: radius.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
            }}
          >
            <Text style={{ color: "#08111f", fontWeight: "800" }}>
              {failed ? "Return to Scanner" : isRefetching ? "Refreshing..." : "Refresh now"}
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
            onPress: () => router.push(`/browser?url=${encodeURIComponent(targetUrl)}`),
          }
        : {
            label: "Analyze Something Else",
            icon: "scan-outline" as const,
            onPress: () => router.push("/(tabs)/scan"),
          };

  const bloom = VERDICT_BLOOM[report.risk_level] ?? colors.bgBloom;
  const canRescanWithContext = ["link", "message", "email", "phone", "marketplace", "social", "qr"].includes(scan.scan_type);

  const submitHelpfulFeedback = async () => {
    setSubmittingFeedback(true);
    try {
      await ShieldAPI.feedback(scan.id, "helpful");
      setFeedbackMode("helpful");
      Alert.alert("Feedback saved", "Thanks. This helps calibrate future reports.");
    } catch {
      Alert.alert("Feedback failed", "We could not save feedback right now.");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const submitCorrection = async () => {
    if (!feedbackReason.trim() && !correctedContext.trim() && !feedbackEvidence.trim()) {
      Alert.alert("Add context", "Tell us what was wrong or paste the evidence we should review.");
      return;
    }
    setSubmittingFeedback(true);
    try {
      await ShieldAPI.feedbackDetail(scan.id, {
        feedback: report.risk_level === "safe" || report.risk_level === "low" ? "missed_scam" : "false_positive",
        reason: feedbackReason.trim(),
        corrected_context: correctedContext.trim(),
        evidence: feedbackEvidence.trim(),
      });
      Alert.alert("Submitted for review", "Your correction was sent to the Shield AI review queue.");
    } catch {
      Alert.alert("Feedback failed", "We could not submit the correction right now.");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const rescanWithContext = async () => {
    const input = correctedContext.trim() || scan.raw_input;
    if (!input) {
      Alert.alert("Add corrected context", "Paste the corrected message, URL, phone number, or details to scan again.");
      return;
    }
    setSubmittingFeedback(true);
    try {
      let nextScan: Scan | null = null;
      if (scan.scan_type === "link") nextScan = await ShieldAPI.scanLink(input);
      if (scan.scan_type === "qr") nextScan = await ShieldAPI.scanQR(input);
      if (scan.scan_type === "message") nextScan = await ShieldAPI.scanMessage(input, "correction");
      if (scan.scan_type === "email") nextScan = await ShieldAPI.scanEmail({ body_text: input });
      if (scan.scan_type === "phone") nextScan = await ShieldAPI.scanPhone(input);
      if (scan.scan_type === "marketplace") nextScan = await ShieldAPI.scanMarketplace(input, "correction");
      if (scan.scan_type === "social") nextScan = await ShieldAPI.scanSocial(input, "correction");
      if (scan.scan_type === "voice") nextScan = await ShieldAPI.scanVoice(input);
      if (nextScan?.id) router.replace(`/result?id=${nextScan.id}`);
    } catch {
      Alert.alert("Re-scan failed", "We could not run the corrected scan right now.");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <GlowBackground accent={bloom} bloomOpacity={1} centerY={0.1} />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + 8, paddingBottom: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ width: 70, flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="chevron-back" size={20} color={colors.primaryBright} />
            <Text style={{ color: colors.primaryBright, fontSize: 13 }}>Back</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>Scan Result Detail</Text>
          <View style={{ width: 70 }} />
        </View>
        <View style={{ minHeight: 166, borderRadius: radius.md, backgroundColor: accent, alignItems: "center", justifyContent: "center", padding: 18, ...glow(accent, "md") }}>
          <Ionicons name={report.risk_level === "safe" ? "shield-checkmark-outline" : "warning-outline"} size={48} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 25, fontWeight: "900", marginTop: 8 }}>{report.risk_level.toUpperCase()} RISK</Text>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600", marginTop: 2 }}>
            {report.risk_level === "safe" ? "No Threats Detected" : "Do Not Interact"}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 10, marginTop: 7 }}>
            {report.threat_category} · {Math.round(report.confidence * 100)}% confidence · score {report.risk_score}/100
          </Text>
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
          <GradientButton
            label={primaryAction.label}
            icon={primaryAction.icon}
            onPress={primaryAction.onPress}
            stops={
              report.risk_level === "critical" || report.risk_level === "high"
                ? gradients.critical
                : report.risk_level === "safe"
                  ? gradients.safe
                  : gradients.primary
            }
          />
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: spacing.sm }}>
            Why we think this
          </Text>
          <View style={{ backgroundColor: colors.glassDeep, borderRadius: 22, padding: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
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
                  backgroundColor: colors.glassDeep,
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
                backgroundColor: colors.glassDeep,
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

        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: spacing.sm }}>
            Improve this verdict
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: spacing.sm }}>
            Confirm the verdict or send a correction with context for analyst review and future model tuning.
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm }}>
          <Pressable
            onPress={submitHelpfulFeedback}
            disabled={submittingFeedback}
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
            onPress={() => setFeedbackMode(feedbackMode === "not_accurate" ? null : "not_accurate")}
            disabled={submittingFeedback}
            style={{
              flex: 1,
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: feedbackMode === "not_accurate" ? `${colors.suspicious}1f` : colors.glassDeep,
              borderWidth: 1,
              borderColor: feedbackMode === "not_accurate" ? `${colors.suspicious}55` : colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: feedbackMode === "not_accurate" ? colors.suspicious : colors.textMuted, fontWeight: "700" }}>Not accurate</Text>
          </Pressable>
        </View>

        {feedbackMode === "not_accurate" && (
          <View
            style={{
              backgroundColor: colors.glassDeep,
              borderRadius: radius.lg,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: spacing.lg,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800", marginBottom: spacing.sm }}>What should we fix?</Text>
            <TextInput
              placeholder="Example: This was from my bank, or this was actually a scam."
              placeholderTextColor={colors.textMuted}
              value={feedbackReason}
              onChangeText={setFeedbackReason}
              multiline
              style={{ backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, padding: spacing.md, minHeight: 78, textAlignVertical: "top", marginBottom: spacing.sm }}
            />
            <TextInput
              placeholder="Corrected context or original text to re-scan"
              placeholderTextColor={colors.textMuted}
              value={correctedContext}
              onChangeText={setCorrectedContext}
              multiline
              style={{ backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, padding: spacing.md, minHeight: 90, textAlignVertical: "top", marginBottom: spacing.sm }}
            />
            <TextInput
              placeholder="Evidence to attach for review (headers, URLs, usernames, transaction IDs)"
              placeholderTextColor={colors.textMuted}
              value={feedbackEvidence}
              onChangeText={setFeedbackEvidence}
              multiline
              style={{ backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, padding: spacing.md, minHeight: 90, textAlignVertical: "top", marginBottom: spacing.md }}
            />
            <View style={{ gap: spacing.sm }}>
              <Pressable
                onPress={submitCorrection}
                disabled={submittingFeedback}
                style={{ backgroundColor: colors.primaryBright, borderRadius: radius.md, padding: spacing.md, alignItems: "center", opacity: submittingFeedback ? 0.6 : 1 }}
              >
                <Text style={{ color: "#08111f", fontWeight: "900" }}>{submittingFeedback ? "Submitting..." : "Submit Correction"}</Text>
              </Pressable>
              {canRescanWithContext && (
                <Pressable
                  onPress={rescanWithContext}
                  disabled={submittingFeedback}
                  style={{ backgroundColor: colors.glassDeep, borderRadius: radius.md, padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border, opacity: submittingFeedback ? 0.6 : 1 }}
                >
                  <Text style={{ color: colors.primaryBright, fontWeight: "800" }}>Re-scan With Corrected Context</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

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
            backgroundColor: colors.glassDeep,
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
