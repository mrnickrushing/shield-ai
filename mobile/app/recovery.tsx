import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Button, Eyebrow, FadeIn, GlowOrb, Surface } from "@/components/ui";
import { ShieldAPI } from "@/lib/api";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";

const SCAM_TYPES = [
  { key: "bank_transfer",    label: "Bank Transfer",    icon: "card-outline" as const,            description: "Wire, Zelle, ACH, or check fraud",           iconColor: colors.critical },
  { key: "gift_card",        label: "Gift Cards",        icon: "gift-outline" as const,            description: "Asked to pay using gift cards",               iconColor: colors.high },
  { key: "crypto",           label: "Cryptocurrency",    icon: "logo-bitcoin" as const,            description: "Bitcoin, Ethereum, or other crypto",          iconColor: colors.suspicious },
  { key: "marketplace",      label: "Marketplace",       icon: "storefront-outline" as const,      description: "eBay, Facebook, Craigslist fraud",            iconColor: colors.low },
  { key: "account_takeover", label: "Account Takeover",  icon: "lock-open-outline" as const,       description: "Someone accessed your accounts",             iconColor: colors.critical },
  { key: "romance",          label: "Romance Scam",      icon: "heart-dislike-outline" as const,   description: "Online relationship leading to money request", iconColor: colors.high },
  { key: "investment",       label: "Investment Fraud",  icon: "trending-up-outline" as const,     description: "Fake trading platforms or Ponzi scheme",      iconColor: colors.suspicious },
  { key: "other",            label: "Other",             icon: "alert-circle-outline" as const,    description: "Something else",                              iconColor: colors.textMuted },
];

const URGENCY_COLOR: Record<string, string> = {
  critical: colors.critical, high: colors.high, medium: colors.suspicious, low: colors.low,
};

export default function RecoveryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ scanId?: string }>();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<"select" | "steps" | "evidence">("select");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<string[]>([]);
  const [evidenceText, setEvidenceText] = useState("");
  const [evidenceLabel, setEvidenceLabel] = useState("");

  const { data: steps } = useQuery({
    queryKey: ["wizard", selectedType],
    queryFn: () => ShieldAPI.getWizardSteps(selectedType!),
    enabled: !!selectedType,
  });

  const createIncident = useMutation({
    mutationFn: (type: string) => ShieldAPI.createIncident({ incident_type: type, linked_scan_id: params.scanId }),
    onSuccess: (data: any) => { setIncidentId(data.id); setPhase("steps"); },
  });

  const updateIncident = useMutation({
    mutationFn: (completedSteps: string[]) => ShieldAPI.updateIncident(incidentId!, { steps_completed: completedSteps } as any),
  });

  const addEvidence = useMutation({
    mutationFn: () => ShieldAPI.addEvidence(incidentId!, { evidence_type: "message", content: evidenceText, label: evidenceLabel }),
    onSuccess: () => {
      setEvidenceText(""); setEvidenceLabel("");
      qc.invalidateQueries({ queryKey: ["incidents"] });
      Alert.alert("Saved", "Evidence added to your incident record.");
    },
  });

  const toggleStep = (stepId: string) => {
    const updated = checkedSteps.includes(stepId)
      ? checkedSteps.filter((s) => s !== stepId)
      : [...checkedSteps, stepId];
    setCheckedSteps(updated);
    if (incidentId) updateIncident.mutate(updated);
  };

  if (phase === "select") {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <FadeIn>
          <Surface accent={colors.critical} glow={withAlpha(colors.critical, "30")} style={{ marginBottom: spacing.lg, position: "relative" }}>
            <GlowOrb color={colors.critical} size={200} opacity={0.26} style={{ top: -60, right: -50 }} />
            <Eyebrow style={{ color: colors.critical, marginBottom: spacing.sm }}>RECOVERY</Eyebrow>
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5, marginBottom: 4 }}>Scam Recovery</Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 21 }}>
              What type of scam happened? We&apos;ll give you a step-by-step plan.
            </Text>
          </Surface>
        </FadeIn>

        <FadeIn delay={60}>
          <View style={{ gap: spacing.sm }}>
            {SCAM_TYPES.map((t) => (
              <Surface
                key={t.key}
                onPress={() => { setSelectedType(t.key); createIncident.mutate(t.key); }}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
              >
                <View style={{ width: 42, height: 42, borderRadius: radius.md, backgroundColor: withAlpha(t.iconColor, "22"), alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={t.icon} size={20} color={t.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, letterSpacing: -0.2 }}>{t.label}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Surface>
            ))}
          </View>
        </FadeIn>
      </ScrollView>
    );
  }

  if (phase === "steps") {
    const totalSteps = (steps as any[])?.length ?? 0;
    const progress = totalSteps > 0 ? checkedSteps.length / totalSteps : 0;

    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <FadeIn>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5, marginBottom: 4 }}>Recovery Steps</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.md }}>Work through each step. Tap to mark complete.</Text>
        </FadeIn>

        <FadeIn delay={60}>
          <Surface style={{ marginBottom: spacing.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Eyebrow>PROGRESS</Eyebrow>
              <Text style={{ color: progress === 1 ? colors.safe : colors.primaryBright, fontWeight: "700", fontSize: 12 }}>
                {checkedSteps.length} / {totalSteps} steps
              </Text>
            </View>
            <View style={{ height: 6, backgroundColor: colors.bg, borderRadius: 3, overflow: "hidden" }}>
              <View style={{ height: "100%", width: `${progress * 100}%`, backgroundColor: progress === 1 ? colors.safe : colors.primary, borderRadius: 3 }} />
            </View>
          </Surface>
        </FadeIn>

        <FadeIn delay={100}>
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            {(steps ?? []).map((step: any) => {
              const done = checkedSteps.includes(step.id);
              return (
                <Surface
                  key={step.id}
                  onPress={() => toggleStep(step.id)}
                  accent={done ? colors.safe : undefined}
                  style={done ? { backgroundColor: withAlpha(colors.safe, "14") } : undefined}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: done ? colors.safe : "transparent", borderWidth: 2, borderColor: done ? colors.safe : colors.border, alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                      {done && <Text style={{ color: "#000", fontSize: 11, fontWeight: "900" }}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: done ? colors.safe : colors.text, fontWeight: "700", fontSize: 16, marginBottom: 4, letterSpacing: -0.2 }}>{step.title}</Text>
                      <View style={{ flexDirection: "row", marginBottom: 6 }}>
                        <View style={{ backgroundColor: withAlpha(URGENCY_COLOR[step.urgency] ?? colors.textMuted, "22"), borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: URGENCY_COLOR[step.urgency] ?? colors.textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>{step.urgency}</Text>
                        </View>
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 21 }}>{step.body}</Text>
                      {step.contacts?.map((c: any) => (
                        <Text key={c.label} style={{ color: colors.primaryBright, fontSize: 13, marginTop: 6 }}>→ {c.label}: {c.value}</Text>
                      ))}
                    </View>
                  </View>
                </Surface>
              );
            })}
          </View>
        </FadeIn>

        <FadeIn delay={140}>
          <Button label="Add Evidence" icon="arrow-forward" onPress={() => setPhase("evidence")} style={{ marginTop: spacing.sm }} />
          {incidentId && (
            <Button
              label="Open Case Pack"
              icon="document-text-outline"
              variant="secondary"
              onPress={() => router.push(`/incident?id=${incidentId}`)}
              style={{ marginTop: spacing.sm }}
            />
          )}
        </FadeIn>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
      <FadeIn>
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5, marginBottom: 4 }}>Preserve Evidence</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.lg }}>Add notes, URLs, transaction IDs, or any other details for your report.</Text>
      </FadeIn>

      <FadeIn delay={60}>
        <TextInput
          placeholder="Label (e.g. Scammer message, Transaction ID)"
          placeholderTextColor={colors.textMuted}
          value={evidenceLabel}
          onChangeText={setEvidenceLabel}
          style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, padding: spacing.md, marginBottom: spacing.sm, fontSize: 15 }}
        />
        <TextInput
          placeholder="Paste text, URL, transaction ID, or notes here..."
          placeholderTextColor={colors.textMuted}
          value={evidenceText}
          onChangeText={setEvidenceText}
          multiline
          numberOfLines={5}
          style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, padding: spacing.md, marginBottom: spacing.md, fontSize: 15, textAlignVertical: "top", minHeight: 120 }}
        />
        <Button
          label="Save Evidence"
          onPress={() => { if (evidenceText) addEvidence.mutate(); }}
          disabled={!evidenceText}
          loading={addEvidence.isPending}
          style={{ marginBottom: spacing.md }}
        />
        <Pressable
          onPress={() => (incidentId ? router.replace(`/incident?id=${incidentId}`) : router.back())}
          style={{ padding: spacing.md, alignItems: "center" }}
        >
          <Text style={{ color: colors.primaryBright, fontSize: 15 }}>View Recovery Case Pack →</Text>
        </Pressable>
      </FadeIn>
    </ScrollView>
  );
}
