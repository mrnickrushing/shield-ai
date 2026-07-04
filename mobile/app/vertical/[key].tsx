import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";

import { ShieldAPI, type Verdict, type VerticalInfo } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

const RISK_TINT: Record<string, string> = {
  safe: colors.safe,
  low: colors.low,
  suspicious: colors.suspicious,
  high: colors.high,
  critical: colors.critical,
};

export default function VerticalScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const [input, setInput] = useState("");

  const { data: catalog } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => ShieldAPI.listVerticals(),
    staleTime: 300_000,
  });
  const info: VerticalInfo | undefined = catalog?.find((v) => v.key === key);

  const mutation = useMutation({
    mutationFn: (vars: { text?: string; file?: string }) => {
      if (!key) throw new Error("Vertical unavailable");
      return vars.file
        ? ShieldAPI.scanVerticalFile(key, vars.file)
        : ShieldAPI.scanVertical(key, (vars.text ?? "").trim());
    },
  });

  async function pickAndScan() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
      if (res.canceled || !res.assets[0]?.base64) return;
      mutation.mutate({ file: res.assets[0].base64 });
    } catch {
      /* picker cancelled or unavailable */
    }
  }

  const accent = info?.accent ?? colors.primaryBright;
  const multiline = info?.input_multiline ?? true;
  const verdict = mutation.data;
  const canScan = Boolean(key && input.trim()) && !mutation.isPending;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ color: accent, fontSize: 12, fontWeight: "800", letterSpacing: 1.1, marginBottom: 6 }}>
        {(info?.name ?? "Vertical").toUpperCase()}
      </Text>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.5, marginBottom: spacing.lg }}>
        {info?.tagline ?? "Analyze something suspicious."}
      </Text>

      <Text style={{ color: colors.textDim, fontSize: 12, fontWeight: "800", letterSpacing: 1, marginBottom: spacing.sm }}>
        {(info?.input_label ?? "Paste content").toUpperCase()}
      </Text>
      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder={info?.input_placeholder ?? "Paste content to analyze..."}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={{
          minHeight: multiline ? 140 : 52,
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
          padding: spacing.md,
          fontSize: 15,
          textAlignVertical: "top",
          marginBottom: spacing.md,
        }}
      />

      <Pressable
        disabled={!canScan}
        onPress={() => mutation.mutate({ text: input })}
        style={{
          backgroundColor: canScan ? accent : colors.surfaceActive,
          borderRadius: radius.md,
          padding: spacing.md,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: spacing.sm,
          opacity: mutation.isPending ? 0.7 : 1,
        }}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#08111f" />
        ) : (
          <Ionicons name="sparkles-outline" size={18} color="#08111f" />
        )}
        <Text style={{ color: "#08111f", fontWeight: "900", fontSize: 15 }}>
          {mutation.isPending ? "Analyzing..." : "Analyze"}
        </Text>
      </Pressable>

      {info?.accepts_files ? (
        <Pressable
          disabled={mutation.isPending}
          onPress={pickAndScan}
          style={{
            marginTop: spacing.sm,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            padding: spacing.md,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="camera-outline" size={18} color={accent} />
          <Text style={{ color: accent, fontWeight: "800", fontSize: 14 }}>
            Or snap a photo of your bill
          </Text>
        </Pressable>
      ) : null}

      {mutation.isError ? (
        <Text style={{ color: colors.critical, marginTop: spacing.md }}>Something went wrong. Please try again.</Text>
      ) : null}

      {verdict ? <VerdictView verdict={verdict} accent={RISK_TINT[verdict.risk_level] ?? accent} /> : null}
    </ScrollView>
  );
}

function VerdictView({ verdict, accent }: { verdict: Verdict; accent: string }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <View
        style={{
          backgroundColor: `${accent}14`,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: `${accent}33`,
          padding: spacing.lg,
          marginBottom: spacing.lg,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              borderWidth: 5,
              borderColor: `${accent}66`,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: `${accent}12`,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>{verdict.risk_score}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>{verdict.risk_level.toUpperCase()}</Text>
            <Text style={{ color: accent, fontSize: 13, fontWeight: "700", marginTop: 2 }}>
              {verdict.threat_category} • {Math.round(verdict.confidence * 100)}% confidence
            </Text>
          </View>
        </View>
        <Text style={{ color: colors.text, lineHeight: 22, fontSize: 15, marginTop: spacing.md }}>{verdict.explanation}</Text>
      </View>

      {verdict.red_flags.length ? (
        <Section title="What we noticed">
          {verdict.red_flags.map((f, i) => (
            <Row key={i} icon="alert-circle-outline" accent={accent} text={f} />
          ))}
        </Section>
      ) : null}

      <ItemizedBreakdown verdict={verdict} />

      <Section title="What to do next">
        {verdict.recommended_actions.map((s, i) => (
          <Row key={i} icon="checkmark-circle-outline" accent={accent} text={s} />
        ))}
      </Section>

      {verdict.output_artifact ? (
        <Section title={verdict.output_title || "Generated"}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
            <Text style={{ color: colors.textDim, fontSize: 14, lineHeight: 21 }}>{verdict.output_artifact}</Text>
          </View>
          <Pressable
            onPress={() => Share.share({ message: verdict.output_artifact })}
            style={{
              marginTop: spacing.sm,
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: spacing.md,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: spacing.sm,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="share-outline" size={18} color={accent} />
            <Text style={{ color: accent, fontWeight: "800" }}>Share / Copy</Text>
          </Pressable>
        </Section>
      ) : null}
    </View>
  );
}

type LineItem = {
  description?: string;
  code?: string;
  amount?: number;
  status?: string;
  reason?: string;
  reference?: number | null;
  multiple?: number | null;
};

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  duplicate: { label: "DUPLICATE", color: colors.critical },
  over_reference: { label: "ABOVE TYPICAL", color: colors.suspicious },
};

function money(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function ItemizedBreakdown({ verdict }: { verdict: Verdict }) {
  const ev = (verdict.evidence ?? {}) as Record<string, any>;
  const items: LineItem[] = Array.isArray(ev.line_items) ? ev.line_items : [];
  if (!items.length) return null;

  const total = Number(ev.estimated_total) || 0;
  const overcharge = Number(ev.estimated_overcharge) || 0;
  const hasOverReference = items.some((li) => li.status === "over_reference");

  return (
    <Section title="Itemized breakdown">
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md }}>
        {items.map((li, i) => {
          const tint = STATUS_STYLE[li.status ?? "ok"];
          return (
            <View
              key={i}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                paddingVertical: spacing.sm,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }} numberOfLines={2}>
                  {li.description || "Line item"}
                </Text>
                {li.code ? (
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>Code {li.code}</Text>
                ) : null}
                {tint && li.reason ? (
                  <Text style={{ color: tint.color, fontSize: 12, marginTop: 3, lineHeight: 16 }}>{li.reason}</Text>
                ) : null}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>{money(Number(li.amount) || 0)}</Text>
                {tint ? (
                  <View
                    style={{
                      marginTop: 4,
                      backgroundColor: `${tint.color}1f`,
                      borderRadius: radius.pill,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 2,
                    }}
                  >
                    <Text style={{ color: tint.color, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 }}>{tint.label}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm, paddingHorizontal: spacing.xs }}>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>Estimated total</Text>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>{money(total)}</Text>
      </View>
      {overcharge > 0 ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingHorizontal: spacing.xs }}>
          <Text style={{ color: colors.critical, fontSize: 13, fontWeight: "700" }}>Likely overcharge</Text>
          <Text style={{ color: colors.critical, fontSize: 13, fontWeight: "800" }}>{money(overcharge)}</Text>
        </View>
      ) : null}
      {hasOverReference && typeof ev.reference_note === "string" ? (
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: spacing.sm, lineHeight: 16 }}>{ev.reference_note}</Text>
      ) : null}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: spacing.sm }}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ icon, accent, text }: { icon: keyof typeof Ionicons.glyphMap; accent: string; text: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: `${accent}22`,
        padding: spacing.md,
        marginBottom: spacing.sm,
      }}
    >
      <Ionicons name={icon} size={18} color={accent} style={{ marginTop: 1 }} />
      <Text style={{ color: colors.text, flex: 1, lineHeight: 21, fontSize: 14 }}>{text}</Text>
    </View>
  );
}
