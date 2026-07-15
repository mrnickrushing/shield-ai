import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GradientButton } from "@/components/GradientButton";
import { GlowBackground } from "@/components/GlowBackground";
import { PressableFX } from "@/components/PressableFX";
import { useAuth } from "@/state/auth";
import { colors, glow, radius, spacing } from "@/theme/theme";

function MenuRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <PressableFX
      onPress={onPress}
      style={{
        height: 64,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: `${colors.primaryBright}76`,
        backgroundColor: colors.glassDeep,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        marginBottom: 11,
        ...glow(colors.primaryBright, "sm"),
      }}
      pressedStyle={{ borderColor: `${colors.primaryBright}cc`, backgroundColor: colors.glassActive }}
    >
      <Ionicons name={icon} size={21} color={colors.primaryBright} />
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600", flex: 1, marginLeft: 15 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
    </PressableFX>
  );
}

function PreferenceRow({ label, description, value, onValueChange }: { label: string; description: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", borderRadius: radius.md, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{label}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={value ? colors.primaryBright : colors.textMuted} />
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, rcPremium, updateProfile, logout } = useAuth();
  const [name, setName] = useState(user?.display_name ?? "");
  const [largeText, setLargeText] = useState(user?.large_text_mode ?? false);
  const [simpleLanguage, setSimpleLanguage] = useState(user?.simple_language_mode ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.display_name ?? "");
    setLargeText(user?.large_text_mode ?? false);
    setSimpleLanguage(user?.simple_language_mode ?? false);
  }, [user?.display_name, user?.large_text_mode, user?.simple_language_mode]);

  const isDirty = name.trim() !== (user?.display_name ?? "") || largeText !== (user?.large_text_mode ?? false) || simpleLanguage !== (user?.simple_language_mode ?? false);
  const save = async () => {
    if (!isDirty) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ display_name: name.trim(), large_text_mode: largeText, simple_language_mode: simpleLanguage });
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  // Fall back to the email handle, never a hardcoded sample name.
  const displayName = user?.display_name?.trim() || user?.email?.split("@")[0] || "Your account";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <GlowBackground accent={colors.bgBloom} centerY={0.3} />
      <View style={{ paddingTop: insets.top + 8, height: insets.top + 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg }}>
        <View style={{ width: 36 }} />
        <Text
          maxFontSizeMultiplier={1.1}
          style={{
            fontSize: 20,
            fontWeight: "900",
            letterSpacing: 0.4,
            color: colors.text,
            textShadowColor: colors.primaryBright,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 12,
          }}
        >
          <Text style={{ color: colors.primaryBright }}>Shield</Text> AI
        </Text>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: `${colors.primaryBright}55`, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="person" size={19} color={colors.primaryBright} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
        <View style={{ alignItems: "center", paddingTop: 20, paddingBottom: 18 }}>
          <View style={{ width: 112, height: 112, borderRadius: 56, borderWidth: 1.5, borderColor: colors.primaryBright, backgroundColor: colors.bg, padding: 7, alignItems: "center", justifyContent: "center", ...glow(colors.primaryBright, "lg") }}>
            <View style={{ width: "100%", height: "100%", borderRadius: 50, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="person" size={58} color={`${colors.primaryBright}a8`} style={{ marginTop: 10 }} />
            </View>
          </View>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: "900", marginTop: 15 }}>{displayName}</Text>
          <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: `${colors.primaryBright}99`, backgroundColor: `${colors.surfaceAlt}cc`, paddingHorizontal: 20, paddingVertical: 10, ...glow(colors.primaryBright, "md") }}>
            <Ionicons name="shield-checkmark" size={15} color={colors.primaryBright} />
            <Text style={{ color: colors.primaryBright, fontWeight: "800", fontSize: 14 }}>
              {user?.is_premium || rcPremium ? "Premium protection active" : "Protection active"}
            </Text>
          </View>
        </View>

        <MenuRow icon="shield-checkmark-outline" label="Account Security" onPress={() => router.push("/privacy")} />
        <MenuRow icon="lock-closed-outline" label="Privacy Preferences" onPress={() => router.push("/privacy")} />
        <MenuRow icon="notifications-outline" label="Notification Settings" onPress={() => router.push("/notifications")} />
        <MenuRow icon="phone-portrait-outline" label="Linked Devices" onPress={() => router.push("/developer")} />

        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 16 }} />
        <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 1.3, marginBottom: 8 }}>PROFILE PREFERENCES</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Display name"
          placeholderTextColor={colors.textMuted}
          style={{ backgroundColor: colors.surface, borderColor: isDirty ? colors.primaryBright : colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, padding: 13, marginBottom: 8 }}
        />
        <PreferenceRow label="Large Text Mode" description="Increase text sizes throughout the app." value={largeText} onValueChange={setLargeText} />
        <PreferenceRow label="Simple Language" description="Use plain language in protection reports." value={simpleLanguage} onValueChange={setSimpleLanguage} />
        {error ? <Text style={{ color: colors.critical, fontSize: 12, marginBottom: 8 }}>{error}</Text> : null}
        <GradientButton label="Save Changes" onPress={save} disabled={!isDirty} loading={saving} icon="checkmark" />

        <Pressable
          onPress={async () => { await logout(); router.replace("/login"); }}
          style={{ height: 48, marginTop: 12, borderRadius: radius.md, borderWidth: 1, borderColor: `${colors.critical}66`, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.critical} />
          <Text style={{ color: colors.critical, fontWeight: "700" }}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
