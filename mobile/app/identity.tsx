import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Eyebrow, FadeIn, Surface } from "@/components/ui";
import { ShieldAPI, BreachResult, IdentityAlert, MonitoredIdentity } from "@/lib/api";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";

// last_status values come straight from the backend; translate the ones that
// read like errors into calmer human phrasing.
const MONITOR_STATUS_LABELS: Record<string, string> = {
  unavailable: "check pending — data source offline",
  unsupported: "not supported yet",
  pending: "queued for first check",
  clear: "no exposure found",
  breached: "exposure found",
  monitored: "monitoring",
  paused: "paused",
};

const SEVERITY_COLORS: Record<string, string> = {
  none: colors.safe,
  low: colors.suspicious,
  medium: colors.high,
  high: colors.critical,
};

export default function IdentityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const showError = (title: string, e: any) => {
    if (e?.response?.status === 402) {
      Alert.alert(
        "Subscription required",
        "Your Shield AI subscription isn't active. Renew to keep using identity protection.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Manage Subscription", onPress: () => router.push("/paywall" as any) },
        ]
      );
      return;
    }
    Alert.alert(title, e?.response?.data?.detail ?? "Something went wrong. Please try again.");
  };

  const breachMutation = useMutation({
    mutationFn: () => ShieldAPI.breachCheck(email.trim()),
    onSuccess: (data) => {
      setBreachResult(data);
      queryClient.invalidateQueries({ queryKey: ["identity-alerts"] });
    },
    onError: (e) => showError("Breach check failed", e),
  });

  const pwndMutation = useMutation({
    mutationFn: () => ShieldAPI.passwordCheck(password),
    onSuccess: (data) => {
      setPwndResult(data);
      setPassword("");
    },
    onError: (e) => showError("Password check failed", e),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => ShieldAPI.markAlertRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["identity-alerts"] }),
  });
  const addMonitor = useMutation({
    mutationFn: () => ShieldAPI.addMonitoringTarget({ target_type: monitorType, value: monitorTarget.trim() }),
    onSuccess: (createdTarget) => {
      setMonitorTarget("");
      queryClient.setQueryData<MonitoredIdentity[]>(["monitoring-targets"], (current) => [
        createdTarget,
        ...(current ?? []).filter((target) => target.id !== createdTarget.id),
      ]);
      queryClient.invalidateQueries({ queryKey: ["monitoring-targets"] });
      queryClient.invalidateQueries({ queryKey: ["identity-alerts"] });
    },
    onError: (e: any) => showError("Couldn't add monitor", e),
  });
  const removeMonitor = useMutation({
    mutationFn: (id: string) => ShieldAPI.removeMonitoringTarget(id),
    onSuccess: (_, removedId) => {
      queryClient.setQueryData<MonitoredIdentity[]>(["monitoring-targets"], (current) =>
        (current ?? []).map((target) => (
          target.id === removedId ? { ...target, is_active: false } : target
        ))
      );
      queryClient.invalidateQueries({ queryKey: ["monitoring-targets"] });
    },
    onError: (e) => showError("Couldn't remove monitor", e),
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
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + 8, paddingBottom: spacing.xxl }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ width: 35 }}><Ionicons name="chevron-back" size={22} color={colors.textDim} /></Pressable>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>Identity Protection Center</Text>
          <Pressable onPress={() => router.push("/profile")} hitSlop={12} style={{ width: 35, alignItems: "flex-end" }}><Ionicons name="settings-outline" size={21} color={colors.textDim} /></Pressable>
        </View>

        <FadeIn>
          <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: `${colors.primaryBright}99`, backgroundColor: colors.glassDeep, padding: 10, marginBottom: spacing.lg, ...({ shadowColor: colors.primaryBright, shadowOpacity: 0.28, shadowRadius: 13, shadowOffset: { width: 0, height: 0 } }) }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900", marginBottom: 8 }}>Monitoring Status</Text>
            <View style={{ flexDirection: "row", gap: 7 }}>
              {[
                { icon: "shield-checkmark-outline" as const, color: colors.safe, title: "Email Breach\nMonitoring", value: `${(monitoredTargets ?? []).filter((target) => target.target_type === "email" && target.is_active).length} Breaches\nFound` },
                { icon: "lock-closed-outline" as const, color: colors.primaryBright, title: "Credit Freeze\nGuidance", value: "Freeze Active\n(3 Bureaus)" },
                { icon: "eye-off-outline" as const, color: colors.purple, title: "Data Broker\nExposure", value: "Review\nSources" },
              ].map((status) => (
                <View key={status.title} style={{ flex: 1, minHeight: 130, borderRadius: 10, borderWidth: 1, borderColor: status.color, backgroundColor: `${status.color}15`, alignItems: "center", paddingHorizontal: 5, paddingVertical: 10 }}>
                  <Ionicons name={status.icon} size={27} color={status.color} />
                  <Text style={{ color: colors.text, fontSize: 10, lineHeight: 12, textAlign: "center", fontWeight: "800", marginTop: 8 }}>{status.title}</Text>
                  <Text style={{ color: colors.textDim, fontSize: 9, lineHeight: 11, textAlign: "center", marginTop: 4 }}>{status.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeIn>

        <FadeIn delay={30}>
          <Surface
            accent={colors.purple}
            onPress={() => router.push("/exposure" as any)}
            style={{ marginBottom: spacing.lg }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: withAlpha(colors.purple, "22"), alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="eye-off-outline" size={19} color={colors.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>Erase yourself from data brokers</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  Guided removal from 16 people-search sites
                </Text>
              </View>
              <Text style={{ color: colors.purple, fontWeight: "800", fontSize: 12 }}>Start →</Text>
            </View>
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
                    The breach database is temporarily unreachable — showing guidance only. Try again shortly.
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
                    {target.target_type} · {MONITOR_STATUS_LABELS[target.last_status] ?? target.last_status} ·{" "}
                    {target.last_checked_at ? new Date(target.last_checked_at).toLocaleString() : "not checked yet"}
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
