import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/state/auth";
import { colors, radius, spacing } from "@/theme/theme";

export default function Profile() {
  const router = useRouter();
  const { user, updateProfile, logout } = useAuth();
  const [name, setName] = useState(user?.display_name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = name.trim() !== (user?.display_name ?? "");

  const save = async () => {
    if (!isDirty) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfile(name.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const initials = (user?.display_name || user?.email || "?")
    .split(" ")
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {/* Avatar */}
        <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: spacing.sm,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800" }}>{initials}</Text>
          </View>
          <View
            style={{
              backgroundColor: user?.is_premium ? "#7c3aed" : colors.surface,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                color: user?.is_premium ? "#fff" : colors.textMuted,
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 0.8,
              }}
            >
              {user?.is_premium ? "PREMIUM" : "FREE"}
            </Text>
          </View>
        </View>

        {/* Display name */}
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 12,
            marginBottom: spacing.xs,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Display Name
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          onSubmitEditing={save}
          style={{
            backgroundColor: colors.surface,
            borderColor: isDirty ? colors.primary : colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            color: colors.text,
            padding: spacing.md,
            marginBottom: spacing.lg,
          }}
        />

        {/* Email (read-only) */}
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 12,
            marginBottom: spacing.xs,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Email
        </Text>
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: spacing.md,
            marginBottom: spacing.xl,
          }}
        >
          <Text style={{ color: colors.textMuted }}>{user?.email}</Text>
        </View>

        {error && (
          <Text style={{ color: colors.critical, marginBottom: spacing.md }}>{error}</Text>
        )}

        <Pressable
          onPress={save}
          disabled={saving || !isDirty}
          style={{
            backgroundColor: isDirty ? colors.primary : colors.surface,
            padding: spacing.md,
            borderRadius: radius.md,
            alignItems: "center",
            marginBottom: spacing.md,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              style={{
                color: isDirty ? "#fff" : colors.textMuted,
                fontWeight: "700",
              }}
            >
              {saved ? "Saved ✓" : "Save Changes"}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={async () => {
            await logout();
            router.replace("/login");
          }}
          style={{
            padding: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.critical,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.critical, fontWeight: "600" }}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
