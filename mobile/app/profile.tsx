import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { useAuth } from "@/state/auth";
import { colors, radius, spacing } from "@/theme/theme";

function SettingRow({ label, description, value, onValueChange }: { label: string; description: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15, marginBottom: 2 }}>{label}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={value ? colors.primaryBright : colors.textMuted}
      />
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const { user, updateProfile, logout } = useAuth();
  const [name, setName] = useState(user?.display_name ?? "");
  const [largeText, setLargeText] = useState(user?.large_text_mode ?? false);
  const [simpleLanguage, setSimpleLanguage] = useState(user?.simple_language_mode ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.display_name ?? "");
    setLargeText(user?.large_text_mode ?? false);
    setSimpleLanguage(user?.simple_language_mode ?? false);
  }, [user?.display_name, user?.large_text_mode, user?.simple_language_mode]);

  const isDirty =
    name.trim() !== (user?.display_name ?? "") ||
    largeText !== (user?.large_text_mode ?? false) ||
    simpleLanguage !== (user?.simple_language_mode ?? false);

  const save = async () => {
    if (!isDirty) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ display_name: name.trim(), large_text_mode: largeText, simple_language_mode: simpleLanguage });
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>

        {/* Avatar + tier */}
        <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm }}>
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800" }}>{initials}</Text>
          </View>
          <View style={{ backgroundColor: user?.is_premium ? colors.purple : colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 }}>
            <Text style={{ color: user?.is_premium ? "#fff" : colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.8 }}>
              {user?.is_premium ? "✦  PREMIUM" : "FREE"}
            </Text>
          </View>
        </View>

        {/* Display name */}
        <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: spacing.xs, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "700" }}>Display Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          onSubmitEditing={save}
          style={{ backgroundColor: colors.surface, borderColor: isDirty ? colors.primary : colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, padding: spacing.md, marginBottom: spacing.lg }}
        />

        {/* Email */}
        <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: spacing.xs, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "700" }}>Email</Text>
        <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xl }}>
          <Text style={{ color: colors.textMuted }}>{user?.email}</Text>
        </View>

        {/* Accessibility settings */}
        <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "700" }}>Accessibility</Text>
        <SettingRow
          label="Large Text Mode"
          description="Increases font sizes throughout the app."
          value={largeText}
          onValueChange={setLargeText}
        />
        <SettingRow
          label="Simple Language"
          description="Uses plain, easy-to-read language in reports."
          value={simpleLanguage}
          onValueChange={setSimpleLanguage}
        />

        {error && <Text style={{ color: colors.critical, marginBottom: spacing.md, marginTop: spacing.sm }}>{error}</Text>}

        <Pressable
          onPress={save}
          disabled={saving || !isDirty}
          style={{ backgroundColor: isDirty ? colors.primary : colors.surface, padding: spacing.md, borderRadius: radius.md, alignItems: "center", marginBottom: spacing.md, marginTop: spacing.sm, opacity: saving ? 0.7 : 1 }}
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <Text style={{ color: isDirty ? "#fff" : colors.textMuted, fontWeight: "700" }}>
              {saved ? "Saved ✓" : "Save Changes"}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={async () => { await logout(); router.replace("/login"); }}
          style={{ padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.critical, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: spacing.sm }}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.critical} />
          <Text style={{ color: colors.critical, fontWeight: "600" }}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
