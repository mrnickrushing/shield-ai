import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";

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
  removed: [],
  not_listed: [],
};

function BrokerCard({ broker }: { broker: BrokerExposureItem }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[broker.status];

  const mutation = useMutation({
    mutationFn: (status: BrokerStatus) => ShieldAPI.updateBrokerStatus(broker.key, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["broker-exposure"] }),
  });

  return (
    <Surface style={{ marginBottom: spacing.sm }}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{broker.name}</Text>
            <Text style={{ color: meta.color, fontSize: 12 }}>{meta.label}</Text>
          </View>
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
            </Surface>
          </FadeIn>

          {data.brokers.map((broker, i) => (
            <FadeIn key={broker.key} delay={60 + Math.min(i, 8) * 30}>
              <BrokerCard broker={broker} />
            </FadeIn>
          ))}

          <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: spacing.md }}>
            Removal requests are honored under CCPA/state privacy laws. Brokers
            sometimes re-list after 6–12 months — check back occasionally.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
