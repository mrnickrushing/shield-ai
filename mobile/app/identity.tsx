import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

import { ShieldAPI, BreachResult, IdentityAlert } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

const SEVERITY_COLORS: Record<string, string> = {
  none: colors.safe ?? "#22c55e",
  low: "#facc15",
  medium: "#f97316",
  high: colors.critical ?? "#ef4444",
};

export default function IdentityScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [breachResult, setBreachResult] = useState<BreachResult | null>(null);
  const [pwndResult, setPwndResult] = useState<{
    pwned_count: number;
    is_compromised: boolean;
    recommendation: string;
  } | null>(null);

  const { data: alerts } = useQuery({
    queryKey: ["identity-alerts"],
    queryFn: () => ShieldAPI.listIdentityAlerts(),
    staleTime: 60_000,
  });

  const breachMutation = useMutation({
    mutationFn: () => ShieldAPI.breachCheck(email.trim()),
    onSuccess: (data) => {
      setBreachResult(data);
      queryClient.invalidateQueries({ queryKey: ["identity-alerts"] });
    },
  });

  const pwndMutation = useMutation({
    mutationFn: () => ShieldAPI.passwordCheck(password),
    onSuccess: (data) => {
      setPwndResult(data);
      setPassword("");
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => ShieldAPI.markAlertRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["identity-alerts"] }),
  });

  const inputStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flex: 1,
  } as const;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.primaryBright }}>← Back</Text>
        </Pressable>

        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800", marginBottom: 4 }}>
          Identity Protection
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.lg }}>
          Check if your data appeared in known breaches.
        </Text>

        {/* Breach check */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderColor: colors.border,
          borderWidth: 1,
          padding: spacing.lg,
          marginBottom: spacing.md,
        }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: spacing.sm }}>
            Email Breach Check
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TextInput
              placeholder="your@email.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={inputStyle}
            />
            <Pressable
              onPress={() => breachMutation.mutate()}
              disabled={!email.trim() || breachMutation.isPending}
              style={{
                backgroundColor: email.trim() ? colors.primary : colors.surface,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                justifyContent: "center",
              }}
            >
              {breachMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700" }}>Check</Text>
              )}
            </Pressable>
          </View>

          {breachResult && (
            <View style={{ marginTop: spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
                <View style={{
                  backgroundColor: SEVERITY_COLORS[breachResult.severity],
                  borderRadius: radius.pill,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 3,
                }}>
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12, textTransform: "uppercase" }}>
                    {breachResult.severity}
                  </Text>
                </View>
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {breachResult.breach_count === 0
                    ? "No breaches found"
                    : `Found in ${breachResult.breach_count} breach${breachResult.breach_count === 1 ? "" : "es"}`}
                </Text>
              </View>

              {!breachResult.data_available && (
                <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm }}>
                  Live breach data requires an API key. Showing local guidance only.
                </Text>
              )}

              {breachResult.breaches.length > 0 && (
                <>
                  <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: spacing.xs }}>
                    AFFECTED SERVICES
                  </Text>
                  {breachResult.breaches.slice(0, 5).map((b) => (
                    <View key={b.name} style={{
                      backgroundColor: colors.bg,
                      borderRadius: radius.md,
                      padding: spacing.sm,
                      marginBottom: spacing.xs,
                    }}>
                      <Text style={{ color: colors.text, fontWeight: "600" }}>{b.title}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                        {b.breach_date} · {b.data_classes.slice(0, 3).join(", ")}
                      </Text>
                    </View>
                  ))}
                </>
              )}

              {breachResult.actions.length > 0 && (
                <>
                  <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", marginTop: spacing.sm, marginBottom: spacing.xs }}>
                    RECOMMENDED ACTIONS
                  </Text>
                  {breachResult.actions.map((action, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs }}>
                      <Text style={{ color: colors.primaryBright, fontSize: 13 }}>•</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 13, flex: 1 }}>{action}</Text>
                    </View>
                  ))}
                </>
              )}

              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: spacing.sm, fontStyle: "italic" }}>
                {breachResult.disclaimer}
              </Text>
            </View>
          )}
        </View>

        {/* Password check */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderColor: colors.border,
          borderWidth: 1,
          padding: spacing.lg,
          marginBottom: spacing.md,
        }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: 4 }}>
            Password Check
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm }}>
            Uses k-anonymity — your password is never sent. Only a 5-character hash prefix is transmitted.
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TextInput
              placeholder="Enter a password to check…"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={inputStyle}
            />
            <Pressable
              onPress={() => pwndMutation.mutate()}
              disabled={!password || pwndMutation.isPending}
              style={{
                backgroundColor: password ? colors.primary : colors.surface,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                justifyContent: "center",
              }}
            >
              {pwndMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700" }}>Check</Text>
              )}
            </Pressable>
          </View>

          {pwndResult && (
            <View style={{
              marginTop: spacing.sm,
              backgroundColor: colors.bg,
              borderRadius: radius.md,
              padding: spacing.md,
            }}>
              <Text style={{
                color: pwndResult.is_compromised ? colors.critical : colors.text,
                fontWeight: "700",
                marginBottom: 4,
              }}>
                {pwndResult.is_compromised
                  ? `Compromised — seen ${pwndResult.pwned_count.toLocaleString()} times`
                  : "Not found in known breaches"}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                {pwndResult.recommendation}
              </Text>
            </View>
          )}
        </View>

        {/* Identity alerts */}
        {alerts && alerts.length > 0 && (
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderColor: colors.border,
            borderWidth: 1,
            padding: spacing.lg,
            marginBottom: spacing.md,
          }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: spacing.sm }}>
              Identity Alerts
            </Text>
            {alerts.map((alert: IdentityAlert) => (
              <Pressable
                key={alert.id}
                onPress={() => !alert.is_read && markRead.mutate(alert.id)}
                style={{
                  backgroundColor: alert.is_read ? colors.bg : colors.surfaceAlt ?? colors.bg,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  marginBottom: spacing.xs,
                  borderLeftWidth: 3,
                  borderLeftColor: alert.is_read ? colors.border : colors.critical ?? "#ef4444",
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>
                    {alert.email}
                  </Text>
                  {!alert.is_read && (
                    <View style={{
                      backgroundColor: colors.critical ?? "#ef4444",
                      borderRadius: radius.pill,
                      width: 8,
                      height: 8,
                      marginTop: 4,
                    }} />
                  )}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {(alert.detail as any)?.breach_count} breach{(alert.detail as any)?.breach_count !== 1 ? "es" : ""} detected
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
