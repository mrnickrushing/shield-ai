import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
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

import { Button, Eyebrow, FadeIn, GlowOrb, Surface } from "@/components/ui";
import { BreachPreview, ShieldAPI } from "@/lib/api";
import { useAuth } from "@/state/auth";
import { colors, gradients, radius, spacing, withAlpha } from "@/theme/theme";

export const HAS_SEEN_REVEAL_KEY = "hasSeenBreachReveal";

const SEVERITY_COLORS: Record<string, string> = {
  none: colors.safe,
  low: colors.suspicious,
  medium: colors.high,
  high: colors.critical,
};

export default function RevealScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);

  const [email, setEmail] = useState(user?.email ?? "");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<BreachPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    await SecureStore.setItemAsync(HAS_SEEN_REVEAL_KEY, "true");
    router.replace("/paywall");
  };

  const check = async () => {
    setError(null);
    setChecking(true);
    try {
      const preview = await ShieldAPI.breachPreview(email.trim());
      setResult(preview);
    } catch (e: any) {
      setError(
        e?.response?.status === 429
          ? "That's enough checks for today — start protection to monitor continuously."
          : e?.response?.data?.detail ?? "Couldn't run the check. Please try again."
      );
    } finally {
      setChecking(false);
    }
  };

  const breached = (result?.breach_count ?? 0) > 0;
  const accent = result
    ? breached
      ? SEVERITY_COLORS[result.severity] ?? colors.critical
      : colors.safe
    : colors.primaryBright;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xxl, paddingBottom: 64 }}>
        <FadeIn>
          <View style={{ alignItems: "center", marginBottom: spacing.xl, position: "relative" }}>
            <GlowOrb color={accent} size={220} opacity={0.3} style={{ top: -30 }} />
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: withAlpha(accent, "22"),
                borderWidth: 2,
                borderColor: withAlpha(accent, "44"),
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing.md,
              }}
            >
              <Ionicons name={result ? (breached ? "alert" : "shield-checkmark") : "search"} size={34} color={accent} />
            </View>
            <Eyebrow style={{ marginBottom: spacing.xs }}>BEFORE YOU START</Eyebrow>
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.7, textAlign: "center" }}>
              {result
                ? breached
                  ? `Found in ${result.breach_count} breach${result.breach_count === 1 ? "" : "es"}`
                  : "No known breaches"
                : "Has your email\nalready leaked?"}
            </Text>
            {!result && (
              <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 21 }}>
                We&apos;ll check it against every known data breach — live, right now.
              </Text>
            )}
          </View>
        </FadeIn>

        {!result && (
          <FadeIn delay={60}>
            <Surface style={{ marginBottom: spacing.lg }}>
              <TextInput
                placeholder="your@email.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                style={{
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  color: colors.text,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  fontSize: 16,
                }}
              />
              <Button
                label={checking ? "Checking…" : "Check my exposure"}
                onPress={check}
                disabled={!email.trim() || checking}
                loading={checking}
                gradient={gradients.primary}
              />
            </Surface>
          </FadeIn>
        )}

        {checking && !result && (
          <View style={{ alignItems: "center", paddingVertical: spacing.lg }}>
            <ActivityIndicator color={colors.primaryBright} />
          </View>
        )}

        {result && breached && (
          <FadeIn>
            <Surface accent={accent} glow={withAlpha(accent, "30")} style={{ marginBottom: spacing.lg }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm }}>
                {result.email} appears in breaches including:
              </Text>
              {result.top_breaches.map((name) => (
                <View key={name} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 6 }}>
                  <Ionicons name="warning" size={16} color={accent} />
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{name}</Text>
                </View>
              ))}
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: spacing.sm, lineHeight: 19 }}>
                Criminals use leaked emails and passwords for account takeovers and targeted
                scams. Shield AI watches this address continuously and alerts you the moment
                a new breach appears.
              </Text>
            </Surface>
          </FadeIn>
        )}

        {result && !breached && (
          <FadeIn>
            <Surface accent={colors.safe} style={{ marginBottom: spacing.lg }}>
              <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 21 }}>
                {result.data_available
                  ? "Nothing found today — but breaches surface weekly, and yours can appear in the next one. Shield AI monitors continuously so you hear about it first."
                  : "We couldn't reach the breach database just now. Turn on protection and we'll monitor this address continuously."}
              </Text>
            </Surface>
          </FadeIn>
        )}

        {error && (
          <View style={{ backgroundColor: withAlpha(colors.suspicious, "18"), borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
            <Text style={{ color: colors.textMuted, textAlign: "center", fontSize: 13 }}>{error}</Text>
          </View>
        )}

        <FadeIn delay={result ? 120 : 200}>
          {result ? (
            <Button
              label={breached ? "Turn on protection →" : "Start protection →"}
              onPress={finish}
              gradient={gradients.primary}
              style={{ marginBottom: spacing.sm }}
            />
          ) : (
            <Pressable onPress={finish} style={{ padding: spacing.md, alignItems: "center" }}>
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>Skip for now</Text>
            </Pressable>
          )}
          {result && (
            <Pressable
              onPress={() => {
                setResult(null);
                setEmail("");
              }}
              style={{ padding: spacing.sm, alignItems: "center" }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Check a different email</Text>
            </Pressable>
          )}
        </FadeIn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
