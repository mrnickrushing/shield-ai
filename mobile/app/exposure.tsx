import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";

import { Eyebrow, FadeIn, Surface } from "@/components/ui";
import { BrokerExposureItem, BrokerStatus, ShieldAPI } from "@/lib/api";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";

const STATUS_META: Record<BrokerStatus, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  not_started: { label: "Not checked", color: colors.textMuted, icon: "ellipse-outline" },
  found: { label: "Listed", color: colors.high, icon: "alert-circle" },
  requested: { label: "Removal requested", color: colors.suspicious, icon: "time" },
  removed: { label: "Removed", color: colors.safe, icon: "checkmark-circle" },
  not_listed: { label: "Not listed", color: colors.safe, icon: "checkmark-circle-outline" },
};

// The natural next states a tap can move a broker into.
const NEXT_ACTIONS: Record<BrokerStatus, { to: BrokerStatus; label: string }[]> = {
  not_started: [
    { to: "found", label: "I found my listing" },
    { to: "not_listed", label: "I'm not listed" },
  ],
  found: [{ to: "requested", label: "I submitted the opt-out" }],
  requested: [{ to: "removed", label: "It's been removed" }],
  removed: [{ to: "found", label: "It came back" }],
  not_listed: [],
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function BrokerCard({ broker }: { broker: BrokerExposureItem }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [listingUrl, setListingUrl] = useState(broker.listing_url);
  const meta = STATUS_META[broker.status];

  const mutation = useMutation({
    mutationFn: (status: BrokerStatus) =>
      ShieldAPI.updateBrokerStatus(broker.key, status, undefined, listingUrl.trim()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["broker-exposure"] }),
  });

  const letterMutation = useMutation({
    mutationFn: () => ShieldAPI.brokerOptOutLetter(broker.key),
    onSuccess: async (letter) => {
      if (letter.privacy_email) {
        // One tap: pre-addressed email with the letter filled in.
        const url = `mailto:${letter.privacy_email}?subject=${encodeURIComponent(letter.subject)}&body=${encodeURIComponent(letter.body)}`;
        const canMail = await Linking.canOpenURL(url).catch(() => false);
        if (canMail) {
          Linking.openURL(url);
          return;
        }
      }
      // No known privacy inbox: copy the letter, then open the opt-out form.
      await Clipboard.setStringAsync(`${letter.subject}\n\n${letter.body}`);
      Alert.alert(
        "Letter copied",
        `Your removal request is on the clipboard. Paste it into ${letter.broker_name}'s opt-out form.`,
        [
          { text: "Share instead", onPress: () => Share.share({ message: letter.body, title: letter.subject }) },
          { text: "Open opt-out page", onPress: () => Linking.openURL(letter.opt_out_url) },
        ]
      );
    },
    onError: () => Alert.alert("Couldn't build the letter", "Please try again."),
  });

  const showListingInput = broker.status === "found" || broker.status === "requested";

  return (
    <Surface style={{ marginBottom: spacing.sm }}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{broker.name}</Text>
            <Text style={{ color: meta.color, fontSize: 12 }}>
              {meta.label}
              {broker.status === "requested" && broker.check_back_on
                ? broker.overdue
                  ? " · past promised removal date"
                  : ` · check back ${formatDate(broker.check_back_on)}`
                : ""}
            </Text>
          </View>
          {broker.overdue && (
            <View style={{ backgroundColor: withAlpha(colors.suspicious, "22"), borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: colors.suspicious, fontSize: 10, fontWeight: "800" }}>VERIFY</Text>
            </View>
          )}
          {broker.priority === 1 && broker.status === "not_started" && (
            <View style={{ backgroundColor: withAlpha(colors.high, "22"), borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: colors.high, fontSize: 10, fontWeight: "800" }}>HIGH TRAFFIC</Text>
            </View>
          )}
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
        </View>
      </Pressable>

      {expanded && (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>{broker.instructions}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            Typical removal time: ~{broker.expected_days} day{broker.expected_days === 1 ? "" : "s"}
          </Text>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Pressable
              onPress={() => Linking.openURL(broker.search_url)}
              style={{ flex: 1, backgroundColor: withAlpha(colors.primaryBright, "18"), borderRadius: radius.md, padding: spacing.sm, alignItems: "center" }}
            >
              <Text style={{ color: colors.primaryBright, fontWeight: "700", fontSize: 13 }}>Search yourself</Text>
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL(broker.opt_out_url)}
              style={{ flex: 1, backgroundColor: withAlpha(colors.teal, "18"), borderRadius: radius.md, padding: spacing.sm, alignItems: "center" }}
            >
              <Text style={{ color: colors.teal, fontWeight: "700", fontSize: 13 }}>Opt-out page</Text>
            </Pressable>
          </View>

          {showListingInput && (
            <>
              <TextInput
                placeholder="Paste your listing URL (goes into the letter)"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                value={listingUrl}
                onChangeText={setListingUrl}
                onEndEditing={() => {
                  if (listingUrl.trim() && listingUrl.trim() !== broker.listing_url) {
                    mutation.mutate(broker.status);
                  }
                }}
                style={{
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  color: colors.text,
                  padding: spacing.sm,
                  fontSize: 13,
                }}
              />
              <Pressable
                onPress={() => letterMutation.mutate()}
                disabled={letterMutation.isPending}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                  backgroundColor: withAlpha(colors.purple, "18"),
                  borderRadius: radius.md,
                  padding: spacing.sm,
                  opacity: letterMutation.isPending ? 0.6 : 1,
                }}
              >
                <Ionicons name="mail-outline" size={16} color={colors.purple} />
                <Text style={{ color: colors.purple, fontWeight: "700", fontSize: 13 }}>
                  {letterMutation.isPending ? "Building your letter…" : "Send removal request"}
                </Text>
              </Pressable>
            </>
          )}

          {NEXT_ACTIONS[broker.status].map((action) => (
            <Pressable
              key={action.to}
              onPress={() => mutation.mutate(action.to)}
              disabled={mutation.isPending}
              style={{
                borderColor: STATUS_META[action.to].color,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: spacing.sm,
                alignItems: "center",
                opacity: mutation.isPending ? 0.6 : 1,
              }}
            >
              <Text style={{ color: STATUS_META[action.to].color, fontWeight: "700", fontSize: 13 }}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Surface>
  );
}

export default function ExposureScreen() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["broker-exposure"],
    queryFn: ShieldAPI.brokerExposure,
    staleTime: 60_000,
  });

  const scoreColor =
    !data ? colors.textMuted
    : data.exposure_score >= 70 ? colors.high
    : data.exposure_score >= 30 ? colors.suspicious
    : colors.safe;

  const needsVerify = data?.brokers.filter((b) => b.overdue).length ?? 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <FadeIn>
        <Eyebrow style={{ marginBottom: spacing.xs }}>DATA BROKERS</Eyebrow>
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.6, marginBottom: spacing.xs }}>
          How findable are you?
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg }}>
          People-search sites republish your address, phone, and relatives — fuel for
          targeted scams. Work through this list to erase yourself. We never search on
          your behalf; everything happens on the broker&apos;s own site.
        </Text>
      </FadeIn>

      {isLoading && (
        <View style={{ paddingVertical: spacing.xxl, alignItems: "center" }}>
          <ActivityIndicator color={colors.primaryBright} />
        </View>
      )}
      {isError && (
        <Surface>
          <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: "center" }}>
            Couldn&apos;t load the broker list. Check your connection and try again.
          </Text>
        </Surface>
      )}

      {data && (
        <>
          <FadeIn delay={40}>
            <Surface accent={scoreColor} glow={withAlpha(scoreColor, "30")} style={{ alignItems: "center", marginBottom: spacing.lg }}>
              <Text style={{ color: scoreColor, fontSize: 48, fontWeight: "900", letterSpacing: -1 }}>
                {data.exposure_score}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>exposure score — lower is better</Text>
              <Text style={{ color: colors.text, fontSize: 13, marginTop: spacing.xs }}>
                {data.resolved} of {data.total} brokers handled
                {data.in_progress > 0 ? ` · ${data.in_progress} in progress` : ""}
              </Text>
              {needsVerify > 0 && (
                <Text style={{ color: colors.suspicious, fontSize: 13, fontWeight: "700", marginTop: spacing.xs }}>
                  {needsVerify} removal{needsVerify === 1 ? "" : "s"} past the promised date — verify below
                </Text>
              )}
            </Surface>
          </FadeIn>

          {data.brokers.map((broker, i) => (
            <FadeIn key={broker.key} delay={60 + Math.min(i, 8) * 30}>
              <BrokerCard broker={broker} />
            </FadeIn>
          ))}

          <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: spacing.md }}>
            Removal requests are honored under CCPA/state privacy laws. Brokers sometimes
            re-list after 6–12 months — we&apos;ll remind you monthly to re-verify removals.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
