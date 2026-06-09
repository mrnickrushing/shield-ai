import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/state/auth";
import { colors, radius, spacing } from "@/theme/theme";

export default function Dashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const Card = ({ title, body, onPress }: { title: string; body: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 4 }}>{title}</Text>
      <Text style={{ color: colors.textMuted }}>{body}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ color: colors.textMuted, marginBottom: 2 }}>
        Welcome back{user?.display_name ? `, ${user.display_name}` : ""}
      </Text>
      <Text style={{ color: colors.text, fontSize: 26, fontWeight: "800", marginBottom: spacing.lg }}>
        Is it real?
      </Text>

      <Card
        title="Check a Link"
        body="Paste any suspicious URL and get an instant risk report."
        onPress={() => router.push("/(tabs)/scan?type=link")}
      />
      <Card
        title="Scan a Screenshot"
        body="Upload a screenshot of a message, email, or website."
        onPress={() => router.push("/(tabs)/scan?type=image")}
      />
      <Card
        title="Scan History"
        body="Review your past checks and reports."
        onPress={() => router.push("/(tabs)/history")}
      />

      <Pressable onPress={logout} style={{ marginTop: spacing.xl }}>
        <Text style={{ color: colors.textMuted, textAlign: "center" }}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
