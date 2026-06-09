import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ShieldAPI } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

type CardProps = {
  icon: string;
  title: string;
  body: string;
  badge?: number;
  onPress: () => void;
};

function Card({ icon, title, body, badge, onPress }: CardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.lg,
        marginBottom: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
      })}
    >
      <Text style={{ fontSize: 28 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: 2 }}>{title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{body}</Text>
      </View>
      {badge != null && badge > 0 && (
        <View style={{
          backgroundColor: colors.critical,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
          minWidth: 22,
          alignItems: "center",
        }}>
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{badge}</Text>
        </View>
      )}
      <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

export default function ProtectScreen() {
  const router = useRouter();

  const { data: alerts } = useQuery({
    queryKey: ["identity-alerts"],
    queryFn: () => ShieldAPI.listIdentityAlerts(),
    staleTime: 60_000,
  });

  const unreadAlerts = alerts?.filter((a) => !a.is_read).length ?? 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800", marginBottom: 4 }}>
        Protection
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.lg }}>
        Proactive tools to guard your identity and money.
      </Text>

      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.sm }}>
        IDENTITY
      </Text>

      <Card
        icon="🛡️"
        title="Identity Protection"
        body="Check if your email appeared in a data breach and get credit freeze guidance."
        badge={unreadAlerts}
        onPress={() => router.push("/identity")}
      />

      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.md }}>
        BROWSING
      </Text>

      <Card
        icon="🌐"
        title="Safe Browser"
        body="Pre-scan any URL before your browser opens it. See risk score and domain clarity."
        onPress={() => router.push("/browser")}
      />

      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.md }}>
        BUYING & SELLING
      </Text>

      <Card
        icon="🏪"
        title="Marketplace Scan"
        body="Paste a listing or buyer message to detect overpayment, fake escrow, and shipping scams."
        onPress={() => router.push("/(tabs)/scan?type=marketplace")}
      />

      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.md }}>
        SOCIAL MEDIA
      </Text>

      <Card
        icon="📱"
        title="Social Media Scan"
        body="Detect fake giveaways, crypto lures, impersonation, and account-takeover phishing."
        onPress={() => router.push("/(tabs)/scan?type=social")}
      />
    </ScrollView>
  );
}
