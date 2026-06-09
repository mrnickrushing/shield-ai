import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { ShieldAPI } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

const SCAM_TYPES = [
  { key: "bank_transfer", label: "Bank Transfer", icon: "🏦", description: "Wire, Zelle, ACH, or check fraud" },
  { key: "gift_card", label: "Gift Cards", icon: "🎁", description: "Asked to pay using gift cards" },
  { key: "crypto", label: "Cryptocurrency", icon: "₿", description: "Bitcoin, Ethereum, or other crypto" },
  { key: "marketplace", label: "Marketplace", icon: "🛒", description: "eBay, Facebook, Craigslist fraud" },
  { key: "account_takeover", label: "Account Takeover", icon: "🔓", description: "Someone accessed your accounts" },
  { key: "romance", label: "Romance Scam", icon: "💔", description: "Online relationship leading to money request" },
  { key: "investment", label: "Investment Fraud", icon: "📈", description: "Fake trading platforms or Ponzi scheme" },
  { key: "other", label: "Other", icon: "⚠️", description: "Something else" },
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

  const { data: steps } = useQuery({ queryKey: ["wizard", selectedType], queryFn: () => ShieldAPI.getWizardSteps(selectedType!), enabled: !!selectedType });

  const createIncident = useMutation({
    mutationFn: (type: string) => ShieldAPI.createIncident({ incident_type: type, linked_scan_id: params.scanId }),
    onSuccess: (data: any) => { setIncidentId(data.id); setPhase("steps"); },
  });

  const updateIncident = useMutation({
    mutationFn: (completedSteps: string[]) => ShieldAPI.updateIncident(incidentId!, { steps_completed: completedSteps } as any),
  });

  const addEvidence = useMutation({
    mutationFn: () => ShieldAPI.addEvidence(incidentId!, { evidence_type: "message", content: evidenceText, label: evidenceLabel }),
    onSuccess: () => { setEvidenceText(""); setEvidenceLabel(""); qc.invalidateQueries({ queryKey: ["incidents"] }); Alert.alert("Saved", "Evidence added to your incident record."); },
  });

  const toggleStep = (stepId: string) => {
    const updated = checkedSteps.includes(stepId) ? checkedSteps.filter((s) => s !== stepId) : [...checkedSteps, stepId];
    setCheckedSteps(updated);
    if (incidentId) updateIncident.mutate(updated);
  };

  if (phase === "select") {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 4 }}>Scam Recovery</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.lg }}>Select the type of scam to get a guided recovery plan.</Text>
        {SCAM_TYPES.map((t) => (
          <Pressable key={t.key} onPress={() => { setSelectedType(t.key); createIncident.mutate(t.key); }}
            style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceActive : colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md })}
          >
            <Text style={{ fontSize: 28 }}>{t.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>{t.label}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t.description}</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  if (phase === "steps") {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 4 }}>Recovery Steps</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.lg }}>Work through each step. Tap to mark complete.</Text>
        {(steps ?? []).map((step: any) => {
          const done = checkedSteps.includes(step.id);
          return (
            <Pressable key={step.id} onPress={() => toggleStep(step.id)}
              style={{ backgroundColor: done ? "#0f2a18" : colors.surface, borderColor: done ? colors.safe : colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: done ? colors.safe : "transparent", borderWidth: 2, borderColor: done ? colors.safe : colors.border, alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                  {done && <Text style={{ color: "#000", fontSize: 11, fontWeight: "900" }}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: done ? colors.safe : colors.text, fontWeight: "700", fontSize: 16, marginBottom: 4 }}>{step.title}</Text>
                  <View style={{ flexDirection: "row", marginBottom: 6 }}>
                    <View style={{ backgroundColor: (URGENCY_COLOR[step.urgency] ?? colors.textMuted) + "22", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: URGENCY_COLOR[step.urgency] ?? colors.textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>{step.urgency}</Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>{step.body}</Text>
                  {step.contacts?.map((c: any) => <Text key={c.label} style={{ color: colors.primaryBright, fontSize: 13, marginTop: 6 }}>→ {c.label}: {c.value}</Text>)}
                </View>
              </View>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setPhase("evidence")} style={{ backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.lg, alignItems: "center", marginTop: spacing.sm, marginBottom: spacing.lg }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Add Evidence →</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 4 }}>Preserve Evidence</Text>
      <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.lg }}>Add notes, URLs, transaction IDs, or any other details for your report.</Text>
      <TextInput placeholder="Label (e.g. Scammer message, Transaction ID)" placeholderTextColor={colors.textMuted} value={evidenceLabel} onChangeText={setEvidenceLabel}
        style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, padding: spacing.md, marginBottom: spacing.sm, fontSize: 15 }} />
      <TextInput placeholder="Paste text, URL, transaction ID, or notes here..." placeholderTextColor={colors.textMuted} value={evidenceText} onChangeText={setEvidenceText}
        multiline numberOfLines={5}
        style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, padding: spacing.md, marginBottom: spacing.md, fontSize: 15, textAlignVertical: "top", minHeight: 120 }} />
      <Pressable onPress={() => { if (evidenceText) addEvidence.mutate(); }}
        style={{ backgroundColor: evidenceText ? colors.primary : colors.surface, borderRadius: radius.md, padding: spacing.lg, alignItems: "center", marginBottom: spacing.md }}>
        <Text style={{ color: evidenceText ? "#fff" : colors.textMuted, fontWeight: "700", fontSize: 16 }}>Save Evidence</Text>
      </Pressable>
      <Pressable onPress={() => incidentId ? router.replace(`/incident?id=${incidentId}`) : router.back()} style={{ padding: spacing.md, alignItems: "center" }}>
        <Text style={{ color: colors.primaryBright, fontSize: 15 }}>View Full Report →</Text>
      </Pressable>
    </ScrollView>
  );
}
