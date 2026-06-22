import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { Button, Eyebrow, FadeIn, GlowOrb, Surface } from "@/components/ui";
import { useAuth } from "@/state/auth";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";

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

  const SettingRow = ({ label, description, value, onValueChange }: { label: string; description: string; value: boolean; onValueChange: (v: boolean) => void }) => (
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

  const LinkRow = ({
    icon,
    label,
    description,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    description: string;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: pressed ? colors.surfaceActive : colors.surface,
        borderRadius: radius.lg,
        padding: spacing.lg,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.md,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.md,
          backgroundColor: withAlpha(colors.primaryBright, "1a"),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={20} color={colors.primaryBright} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{label}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 1 }}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>

        {/* Avatar + tier */}
        <FadeIn>
          <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
            <View style={{ alignItems: "center", justifyContent: "center", marginBottom: spacing.sm }}>
              <GlowOrb color={colors.primaryBright} size={150} opacity={0.4} style={{ top: -35, left: -35 }} />
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800" }}>{initials}</Text>
              </View>
            </View>
            <View style={{ backgroundColor: user?.is_premium ? colors.purple : colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 }}>
              <Text style={{ color: user?.is_premium ? "#fff" : colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.8 }}>
                {user?.is_premium ? "✦  PREMIUM" : "FREE"}
              </Text>
            </View>
          </View>
        </FadeIn>

        <FadeIn delay={60}>
          {/* Display name */}
          <Eyebrow style={{ marginBottom: spacing.xs }}>Display Name</Eyebrow>
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
          <Eyebrow style={{ marginBottom: spacing.xs }}>Email</Eyebrow>
          <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xl }}>
            <Text style={{ color: colors.textMuted }}>{user?.email}</Text>
          </View>
        </FadeIn>

        <FadeIn delay={100}>
          {/* Accessibility settings */}
          <Eyebrow style={{ marginBottom: spacing.sm }}>Accessibility</Eyebrow>
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

          <Button
            label={saved ? "Saved ✓" : "Save Changes"}
            onPress={save}
            disabled={!isDirty}
            loading={saving}
            variant={isDirty ? "primary" : "secondary"}
            style={{ marginBottom: spacing.lg, marginTop: spacing.sm }}
          />
        </FadeIn>

        <FadeIn delay={140}>
          <Eyebrow style={{ marginBottom: spacing.sm }}>Advanced</Eyebrow>
          <LinkRow
            icon="notifications-outline"
            label="Notifications"
            description="Review alerts and updates we've sent you."
            onPress={() => router.push("/notifications")}
          />
          <LinkRow
            icon="code-slash-outline"
            label="Developer"
            description="Manage API keys for programmatic scanning."
            onPress={() => router.push("/developer")}
          />
        </FadeIn>

        <FadeIn delay={180}>
          <Surface
            onPress={async () => {
              await logout();
              router.replace("/login");
            }}
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: spacing.sm,
              borderColor: colors.critical,
              marginTop: spacing.md,
            }}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.critical} />
            <Text style={{ color: colors.critical, fontWeight: "600" }}>Sign Out</Text>
          </Surface>
        </FadeIn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
