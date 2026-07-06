import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button, Eyebrow, FadeIn, GlowOrb, Surface } from "@/components/ui";
import { ShieldAPI, BreachResult, IdentityAlert, MonitoredIdentity } from "@/lib/api";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";

const SEVERITY_COLORS: Record<string, string> = {
  none: colors.safe,
  low: colors.suspicious,
  medium: colors.high,
  high: colors.critical,
};

export default function IdentityScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [monitorTarget, setMonitorTarget] = useState("");
  const [monitorType, setMonitorType] = useState<"email" | "phone" | "username" | "domain">("email");
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
  const { data: monitoredTargets } = useQuery({
    queryKey: ["monitoring-targets"],
    queryFn: () => ShieldAPI.listMonitoringTargets(),
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
  const addMonitor = useMutation({
    mutationFn: () => ShieldAPI.addMonitoringTarget({ target_type: monitorType, value: monitorTarget.trim() }),
    onSuccess: () => {
      setMonitorTarget("");
      queryClient.invalidateQueries({ queryKey: ["monitoring-targets"] });
    },
  });
  const removeMonitor = useMutation({
    mutationFn: (id: string) => ShieldAPI.removeMonitoringTarget(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["monitoring-targets"] }),
  });

  const inputStyle = {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    padding: spacing.md,
    marginBottom: spacing.sm,
  } as const;

  const unreadCount = alerts?.filter((a) => !a.is_read).length ?? 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: spacing.md }} hitSlop={12}>
          <Text style={{ color: colors.primaryBright, fontSize: 15 }}>← Back</Text>
        </Pressable>

        <FadeIn>
          <Surface
            accent={colors.primaryBright}
            glow={withAlpha(colors.primary, "30")}
            style={{ marginBottom: spacing.lg, position: "relative" }}
          >
            <GlowOrb color={colors.primaryBright} size={200} opacity={0.3} style={{ top: -60, right: -50 }} />
            <Eyebrow style={{ marginBottom: spacing.sm }}>IDENTITY PROTECTION</Eyebrow>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.6, marginBottom: 6 }}>
              Check your exposure.
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 21 }}>
              See if your email or password appeared in a known breach, and review the alerts we&apos;ve already flagged for you.
            </Text>
          </Surface>
        </FadeIn>

        {/* Breach check */}
        <FadeIn delay={60}>
          <Surface style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: spacing.sm }}>
              Email Breach Check
            </Text>
            <View>
              <TextInput
                placeholder="your@email.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                style={inputStyle}
              />
              <Button
                label="Check"
                onPress={() => breachMutation.mutate()}
                disabled={!email.trim()}
                loading={breachMutation.isPending}
              />
            </View>

            {breachResult && (
              <View style={{ marginTop: spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
                  <View
                    style={{
                      backgroundColor: SEVERITY_COLORS[breachResult.severity],
                      borderRadius: radius.pill,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 3,
                    }}
                  >
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
                    <Eyebrow style={{ marginBottom: spacing.xs }}>Affected Services</Eyebrow>
                    {breachResult.breaches.slice(0, 5).map((b) => (
                      <View
                        key={b.name}
                        style={{
                          backgroundColor: colors.bg,
                          borderRadius: radius.md,
                          padding: spacing.sm,
                          marginBottom: spacing.xs,
                        }}
                      >
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
                    <Eyebrow style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}>Recommended Actions</Eyebrow>
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
          </Surface>
        </FadeIn>

        <FadeIn delay={80}>
          <Surface style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: spacing.sm }}>
              Continuous Monitoring
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm }}>
              Add identities once and Shield AI will re-check them on a schedule.
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm }}>
              {(["email", "phone", "username", "domain"] as const).map((type) => {
                const selected = monitorType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setMonitorType(type)}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.md,
                      alignItems: "center",
                      backgroundColor: selected ? withAlpha(colors.primaryBright, "20") : colors.bg,
                      borderWidth: 1,
                      borderColor: selected ? colors.primaryBright : colors.border,
                    }}
                  >
                    <Text style={{ color: selected ? colors.primaryBright : colors.textMuted, fontWeight: "800", fontSize: 11, textTransform: "uppercase" }}>{type}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              placeholder={monitorType === "email" ? "email@example.com" : monitorType === "domain" ? "example.com" : "Target to monitor"}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              value={monitorTarget}
              onChangeText={setMonitorTarget}
              style={inputStyle}
            />
            <Button
              label="Add Monitor"
              onPress={() => addMonitor.mutate()}
              disabled={!monitorTarget.trim()}
              loading={addMonitor.isPending}
              style={{ marginBottom: spacing.md }}
            />
            {(monitoredTargets ?? []).filter((target) => target.is_active).map((target: MonitoredIdentity) => (
              <View
                key={target.id}
                style={{
                  backgroundColor: colors.bg,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  marginBottom: spacing.xs,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{target.value}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {target.target_type} · {target.last_status} · {target.last_checked_at ? new Date(target.last_checked_at).toLocaleString() : "not checked yet"}
                  </Text>
                </View>
                <Pressable onPress={() => removeMonitor.mutate(target.id)} hitSlop={10}>
                  <Text style={{ color: colors.critical, fontWeight: "800" }}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </Surface>
        </FadeIn>

        {/* Password check */}
        <FadeIn delay={100}>
          <Surface style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: 4 }}>
              Password Check
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm }}>
              Uses k-anonymity — your password is never sent. Only a 5-character hash prefix is transmitted.
            </Text>
            <View>
              <TextInput
                placeholder="Enter a password to check…"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                style={inputStyle}
              />
              <Button
                label="Check"
                onPress={() => pwndMutation.mutate()}
                disabled={!password}
                loading={pwndMutation.isPending}
              />
            </View>

            {pwndResult && (
              <View
                style={{
                  marginTop: spacing.sm,
                  backgroundColor: colors.bg,
                  borderRadius: radius.md,
                  padding: spacing.md,
                }}
              >
                <Text
                  style={{
                    color: pwndResult.is_compromised ? colors.critical : colors.text,
                    fontWeight: "700",
                    marginBottom: 4,
                  }}
                >
                  {pwndResult.is_compromised
                    ? `Compromised — seen ${pwndResult.pwned_count.toLocaleString()} times`
                    : "Not found in known breaches"}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>{pwndResult.recommendation}</Text>
              </View>
            )}
          </Surface>
        </FadeIn>

        {/* Identity alerts */}
        {alerts && alerts.length > 0 && (
          <FadeIn delay={140}>
            <Surface>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>Identity Alerts</Text>
                {unreadCount > 0 && (
                  <View
                    style={{
                      backgroundColor: colors.critical,
                      borderRadius: radius.pill,
                      minWidth: 22,
                      height: 22,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 6,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              {alerts.map((alert: IdentityAlert) => (
                <Pressable
                  key={alert.id}
                  onPress={() => !alert.is_read && markRead.mutate(alert.id)}
                  style={({ pressed }) => ({
                    backgroundColor: alert.is_read ? colors.bg : pressed ? colors.surfaceActive : withAlpha(colors.critical, "12"),
                    borderRadius: radius.md,
                    padding: spacing.md,
                    marginBottom: spacing.xs,
                    borderLeftWidth: 3,
                    borderLeftColor: alert.is_read ? colors.border : colors.critical,
                  })}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>{alert.email}</Text>
                    {!alert.is_read && (
                      <View
                        style={{
                          backgroundColor: colors.critical,
                          borderRadius: radius.pill,
                          width: 8,
                          height: 8,
                          marginTop: 4,
                        }}
                      />
                    )}
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {(alert.detail as any)?.breach_count} breach{(alert.detail as any)?.breach_count !== 1 ? "es" : ""} detected
                  </Text>
                </Pressable>
              ))}
            </Surface>
          </FadeIn>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
