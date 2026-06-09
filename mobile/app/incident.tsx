import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator, Pressable, ScrollView, Share, Text, View,
} from "react-native";

import { ShieldAPI } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

const INCIDENT_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer Fraud",
  gift_card: "Gift Card Scam",
  crypto: "Cryptocurrency Fraud",
  marketplace: "Marketplace Scam",
  account_takeover: "Account Takeover",
  romance: "Romance Scam",
  investment: "Investment Fraud",
  other: "Scam Incident",
};

export default function IncidentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: incident, isLoading } = useQuery({
    queryKey: ["incident", id],
    queryFn: () => ShieldAPI.getIncident(id),
  });

  const { data: steps } = useQuery({
    queryKey: ["wizard", incident?.incident_type],
    queryFn: () => ShieldAPI.getWizardSteps((incident as any).incident_type),
    enabled: !!incident,
  });

  const getSummary = useMutation({
    mutationFn: () => ShieldAPI.getIncidentSummary(id),
    onSuccess: async (data: any) => {
      try { await Share.share({ message: data.summary, title: "Scam Incident Report" }); } catch {}
    },
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.primaryBright} />
      </View>
    );
  }

  if (!incident) return null;

  const inc = incident as any;
  const completed = new Set<string>(inc.steps_completed ?? []);
  const totalCount = (steps as any[])?.length ?? 0;
  const completedCount = completed.size;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 4 }}>
        {INCIDENT_LABELS[inc.incident_type] ?? "Scam Incident"}
      </Text>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900", marginBottom: spacing.lg }}>
        {inc.title || "Recovery Case"}
      </Text>

      {inc.amount_lost != null && (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md }}>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 2 }}>Amount lost</Text>
          <Text style={{ color: colors.critical, fontSize: 22, fontWeight: "900" }}>
            {inc.currency} {Number(inc.amount_lost).toLocaleString()}
          </Text>
        </View>
      )}

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md }}>
        <Text style={{ color: colors.text, fontWeight: "700", marginBottom: spacing.sm }}>Recovery Progress</Text>
        <View style={{ height: 6, backgroundColor: colors.bg, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
          <View style={{
            height: "100%",
            width: `${progress * 100}%`,
            backgroundColor: progress === 1 ? colors.safe : colors.primary,
            borderRadius: 3,
          }} />
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{completedCount} of {totalCount} steps completed</Text>
      </View>

      <Pressable
        onPress={() => router.push(`/recovery?scanId=${inc.linked_scan_id ?? ""}`)}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.surfaceActive : colors.surface,
          borderColor: colors.border, borderWidth: 1,
          borderRadius: radius.lg, padding: spacing.lg,
          marginBottom: spacing.md, flexDirection: "row",
          alignItems: "center", justifyContent: "space-between",
        })}
      >
        <Text style={{ color: colors.text, fontWeight: "700" }}>Continue Recovery Steps</Text>
        <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
      </Pressable>

      <Pressable
        onPress={() => getSummary.mutate()}
        style={{
          backgroundColor: colors.primary, borderRadius: radius.md,
          padding: spacing.lg, alignItems: "center",
        }}
      >
        {getSummary.isPending
          ? <ActivityIndicator color="#fff" />
          : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Export Incident Report ↗</Text>}
      </Pressable>
      <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: spacing.sm }}>
        Formatted for bank, police, or platform reports
      </Text>
    </ScrollView>
  );
}
