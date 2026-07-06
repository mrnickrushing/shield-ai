import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from "react-native";

import { Button, Eyebrow, FadeIn, Surface } from "@/components/ui";
import { ShieldAPI } from "@/lib/api";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";

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
  const { data: incident, isLoading } = useQuery({ queryKey: ["incident", id], queryFn: () => ShieldAPI.getIncident(id) });
  const { data: steps } = useQuery({
    queryKey: ["wizard", (incident as any)?.incident_type],
    queryFn: () => ShieldAPI.getWizardSteps((incident as any).incident_type),
    enabled: !!incident,
  });
  const createShare = useMutation({ mutationFn: () => ShieldAPI.createCasePackShare(id) });
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);

  const generateDoc = async (docType: "bank_dispute" | "ftc_complaint" | "police_report") => {
    setGeneratingDoc(docType);
    try {
      const doc = await ShieldAPI.generateIncidentDocument(id, docType);
      await Share.share({ message: doc.body, title: doc.title });
    } catch {
      // Share sheet dismissal also throws on some platforms; nothing to surface.
    } finally {
      setGeneratingDoc(null);
    }
  };

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
  const progress = totalCount > 0 ? completed.size / totalCount : 0;

  const shareCasePack = async () => {
    const [casePack, share] = await Promise.all([
      ShieldAPI.getIncidentCasePack(id, "text"),
      createShare.mutateAsync(),
    ]);
    await Share.share({
      message: [casePack, "", `Secure link: ${share.url}`, `PDF: ${share.pdf_url}`, `Expires: ${new Date(share.expires_at).toLocaleString()}`].join("\n"),
      title: "Shield AI Recovery Case Pack",
    });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
      <FadeIn>
        <Eyebrow style={{ marginBottom: 4 }}>{INCIDENT_LABELS[inc.incident_type] ?? "Scam Incident"}</Eyebrow>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900", marginBottom: spacing.lg }}>
          {inc.title || "Recovery Case"}
        </Text>
      </FadeIn>

      {inc.amount_lost != null && (
        <FadeIn delay={60}>
          <Surface accent={colors.critical} style={{ marginBottom: spacing.md }}>
            <Eyebrow style={{ marginBottom: 2 }}>Amount lost</Eyebrow>
            <Text style={{ color: colors.critical, fontSize: 22, fontWeight: "900" }}>
              {inc.currency} {Number(inc.amount_lost).toLocaleString()}
            </Text>
          </Surface>
        </FadeIn>
      )}

      <FadeIn delay={100}>
        <Surface style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: spacing.sm }}>Recovery Progress</Text>
          <View style={{ height: 6, backgroundColor: colors.bg, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
            <View
              style={{
                height: "100%",
                width: `${progress * 100}%`,
                backgroundColor: progress === 1 ? colors.safe : colors.primary,
                borderRadius: 3,
              }}
            />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{completed.size} of {totalCount} steps completed</Text>
        </Surface>
      </FadeIn>

      <FadeIn delay={120}>
        <Surface accent={colors.primaryBright} style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md }}>
            <View style={{ width: 42, height: 42, borderRadius: radius.md, backgroundColor: withAlpha(colors.primaryBright, "1f"), alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="document-text-outline" size={20} color={colors.primaryBright} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>Recovery Case Pack</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
                Timeline, evidence summary, dispute template, police summary, and next actions.
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.primaryBright, fontWeight: "900", fontSize: 18 }}>{completed.size}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>done</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.suspicious, fontWeight: "900", fontSize: 18 }}>{Math.max(0, totalCount - completed.size)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>remaining</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.safe, fontWeight: "900", fontSize: 18 }}>{inc.linked_scan_id ? "Yes" : "No"}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>scan link</Text>
            </View>
          </View>
        </Surface>
      </FadeIn>

      <FadeIn delay={140}>
        <Surface
          onPress={() => router.push("/recovery")}
          style={{ marginBottom: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>Continue Recovery Steps</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Surface>

        <Eyebrow style={{ marginBottom: spacing.sm }}>Ready-to-send documents</Eyebrow>
        <Surface style={{ marginBottom: spacing.md, gap: spacing.sm }}>
          {(
            [
              { key: "bank_dispute", label: "Bank / card dispute letter", icon: "card-outline" },
              { key: "ftc_complaint", label: "FTC complaint draft", icon: "flag-outline" },
              { key: "police_report", label: "Police report narrative", icon: "shield-outline" },
            ] as const
          ).map((doc) => (
            <Pressable
              key={doc.key}
              onPress={() => generateDoc(doc.key)}
              disabled={generatingDoc !== null}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingVertical: spacing.xs,
                opacity: generatingDoc && generatingDoc !== doc.key ? 0.4 : 1,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: withAlpha(colors.teal, "22"),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {generatingDoc === doc.key ? (
                  <ActivityIndicator size="small" color={colors.teal} />
                ) : (
                  <Ionicons name={doc.icon} size={16} color={colors.teal} />
                )}
              </View>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600", flex: 1 }}>{doc.label}</Text>
              <Ionicons name="share-outline" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
            Written from this case&apos;s details — review before sending.
          </Text>
        </Surface>

        <Button
          label="Share Case Pack"
          icon="share-outline"
          onPress={shareCasePack}
          loading={createShare.isPending}
        />
        <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: spacing.sm }}>
          Formatted for bank, police, or platform reports
        </Text>
      </FadeIn>
    </ScrollView>
  );
}
