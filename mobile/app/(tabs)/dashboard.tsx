import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ShieldAPI } from "@/lib/api";
import { useAuth } from "@/state/auth";
import { colors, radius, spacing } from "@/theme/theme";

type CardProps = {
  icon: string;
  title: string;
  body: string;
  onPress: () => void;
};

function ActionCard({ icon, title, body, onPress }: CardProps) {
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
      <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const { data: notifications } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => ShieldAPI.listNotifications(true),
    staleTime: 30_000,
  });

  const unreadCount = notifications?.length ?? 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.lg }}>
        <View>
          <Text style={{ color: colors.textMuted, marginBottom: 2 }}>
            Welcome back{user?.display_name ? `, ${user.display_name}` : ""}
          </Text>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: "800" }}>
            Is it real?
          </Text>
        </View>

        {unreadCount > 0 && (
          <Pressable
            onPress={() => router.push("/notifications")}
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.pill,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
              minWidth: 28,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{unreadCount}</Text>
          </Pressable>
        )}
      </View>

      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.sm }}>
        ANALYZE
      </Text>

      <ActionCard
        icon="🔗"
        title="Check a Link"
        body="Paste any URL — get a risk score before you click."
        onPress={() => router.push("/(tabs)/scan?type=link")}
      />
      <ActionCard
        icon="📷"
        title="Scan a Screenshot"
        body="Upload a screenshot of a suspicious message or site."
        onPress={() => router.push("/(tabs)/scan?type=image")}
      />
      <ActionCard
        icon="⬛"
        title="Scan a QR Code"
        body="Preview a QR code's destination before you open it."
        onPress={() => router.push("/(tabs)/scan?type=qr")}
      />

      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.md }}>
        ANALYZE CONTENT
      </Text>

      <ActionCard
        icon="💬"
        title="Analyze a Message"
        body="Paste a suspicious text, chat, or marketplace message."
        onPress={() => router.push("/(tabs)/scan?type=message")}
      />
      <ActionCard
        icon="📧"
        title="Check an Email"
        body="Detect spoofed senders, reply-to hijacking, and phishing links."
        onPress={() => router.push("/(tabs)/scan?type=email")}
      />
      <ActionCard
        icon="📞"
        title="Look Up a Phone Number"
        body="Check if a number is linked to scam or spam calls."
        onPress={() => router.push("/(tabs)/scan?type=phone")}
      />

      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.md }}>
        HISTORY
      </Text>

      <ActionCard
        icon="🕒"
        title="Scan History"
        body="Review all your past checks and reports."
        onPress={() => router.push("/(tabs)/history")}
      />

      <Pressable onPress={logout} style={{ marginTop: spacing.xl, marginBottom: spacing.lg }}>
        <Text style={{ color: colors.textMuted, textAlign: "center" }}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
