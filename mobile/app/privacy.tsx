import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Share, Switch, Text, View } from "react-native";

import { Button, Eyebrow, FadeIn, Surface } from "@/components/ui";
import { ShieldAPI } from "@/lib/api";
import { useAuth } from "@/state/auth";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";

const RETENTION_OPTIONS = [
  { key: "30", label: "30 days", description: "Keep recent protection history only." },
  { key: "90", label: "90 days", description: "Balanced history for trends and appeals." },
  { key: "365", label: "1 year", description: "Longest local preference for detailed records." },
  { key: "manual", label: "Manual", description: "Keep history until I purge it." },
];

function ActionRow({
  icon,
  title,
  detail,
  danger,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const accent = danger ? colors.critical : colors.primaryBright;
  return (
    <Surface onPress={onPress} style={{ marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <View style={{ width: 42, height: 42, borderRadius: radius.md, backgroundColor: withAlpha(accent, "1f"), alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? colors.critical : colors.text, fontSize: 15, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Surface>
  );
}

export default function PrivacyScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const logout = useAuth((s) => s.logout);
  const [exporting, setExporting] = useState(false);
  const [purging, setPurging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: privacy } = useQuery({
    queryKey: ["privacy-preferences"],
    queryFn: () => ShieldAPI.getPrivacyPreferences(),
  });
  const { data: sessions } = useQuery({
    queryKey: ["auth-sessions"],
    queryFn: () => ShieldAPI.listSessions(),
  });
  const { data: devices } = useQuery({
    queryKey: ["devices"],
    queryFn: () => ShieldAPI.listDevices(),
  });

  const updatePrivacy = useMutation({
    mutationFn: (payload: { retention_days: number | null; require_device_unlock: boolean }) => ShieldAPI.updatePrivacyPreferences(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["privacy-preferences"] }),
  });
  const revokeSession = useMutation({
    mutationFn: (id: string) => ShieldAPI.revokeSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth-sessions"] }),
  });
  const revokeDevice = useMutation({
    mutationFn: (id: string) => ShieldAPI.revokeDevice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devices"] }),
  });

  const retention = privacy?.retention_days ? String(privacy.retention_days) : "manual";
  const biometricLock = privacy?.require_device_unlock ?? false;

  const setRetentionPreference = (value: string) => {
    updatePrivacy.mutate({
      retention_days: value === "manual" ? null : Number(value),
      require_device_unlock: biometricLock,
    });
  };

  const setLockPreference = async (value: boolean) => {
    if (value) {
      const supported = await LocalAuthentication.hasHardwareAsync();
      const enrolled = supported && await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        Alert.alert(
          "Device unlock unavailable",
          "Set up Face ID, Touch ID, or biometrics in your device settings before enabling this lock."
        );
        return;
      }
    }
    updatePrivacy.mutate({
      retention_days: privacy?.retention_days ?? null,
      require_device_unlock: value,
    });
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const data = await ShieldAPI.exportAccountData();
      const summary = [
        "Shield AI Account Export",
        `Exported: ${new Date(data.exported_at).toLocaleString()}`,
        `Email: ${data.user.email}`,
        "",
        `Scans: ${data.scans.length}`,
        `Recovery cases: ${data.incidents.length}`,
        `Notifications: ${data.notifications.length}`,
        `Community reports: ${data.community_reports.length}`,
        `Identity alerts: ${data.identity_alerts.length}`,
        "",
        JSON.stringify(data, null, 2),
      ].join("\n");
      await Share.share({ title: "Shield AI Account Export", message: summary });
    } catch (e: any) {
      Alert.alert("Export failed", e?.response?.data?.detail ?? "We could not export your data right now.");
    } finally {
      setExporting(false);
    }
  };

  const confirmPurge = () => {
    Alert.alert(
      "Purge scan history?",
      "This removes your scan history and linked reports from your account. Recovery cases remain, but they will no longer link back to deleted scans.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Purge",
          style: "destructive",
          onPress: async () => {
            setPurging(true);
            try {
              const result = await ShieldAPI.purgeScanHistory();
              Alert.alert("Scan history purged", `${result.deleted_scans} scans were removed.`);
            } catch (e: any) {
              Alert.alert("Purge failed", e?.response?.data?.detail ?? "We could not purge scan history right now.");
            } finally {
              setPurging(false);
            }
          },
        },
      ]
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete your account?",
      "This permanently removes your account, scans, recovery cases, devices, contacts, API keys, and alerts. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await ShieldAPI.deleteAccount();
              await logout();
              router.replace("/login");
            } catch (e: any) {
              Alert.alert("Delete failed", e?.response?.data?.detail ?? "We could not delete your account right now.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
      <FadeIn>
        <Surface accent={colors.primaryBright} style={{ marginBottom: spacing.lg }}>
          <Eyebrow style={{ marginBottom: spacing.sm }}>PRIVACY CENTER</Eyebrow>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900", marginBottom: spacing.sm }}>Your data controls</Text>
          <Text style={{ color: colors.textMuted, lineHeight: 21 }}>
            Export account data, control history retention, purge incident history, and remove active access from this device.
          </Text>
        </Surface>
      </FadeIn>

      <FadeIn delay={60}>
        <Eyebrow style={{ marginBottom: spacing.sm }}>Data</Eyebrow>
        <ActionRow icon="download-outline" title="Export my data" detail={exporting ? "Preparing your account export..." : "Share a full JSON account export with scans, cases, alerts, and reports."} onPress={exportData} />
        <ActionRow icon="trash-outline" title="Purge scan history" detail={purging ? "Purging scan history..." : "Remove scans and generated risk reports from your account."} danger onPress={confirmPurge} />
      </FadeIn>

      <FadeIn delay={100}>
        <Eyebrow style={{ marginBottom: spacing.sm, marginTop: spacing.lg }}>Retention</Eyebrow>
        <View style={{ gap: spacing.sm }}>
          {RETENTION_OPTIONS.map((option) => {
            const selected = retention === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setRetentionPreference(option.key)}
                style={{
                  backgroundColor: selected ? withAlpha(colors.primaryBright, "18") : colors.surface,
                  borderColor: selected ? colors.primaryBright : colors.border,
                  borderWidth: 1,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? colors.primaryBright : colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "800" }}>{option.label}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>{option.description}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </FadeIn>

      <FadeIn delay={140}>
        <Eyebrow style={{ marginBottom: spacing.sm, marginTop: spacing.lg }}>Access</Eyebrow>
        <Surface style={{ marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Ionicons name="finger-print-outline" size={22} color={colors.primaryBright} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "800" }}>Require device unlock</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Require Face ID, Touch ID, or your device passcode to open the app.</Text>
          </View>
          <Switch
            value={biometricLock}
            onValueChange={setLockPreference}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={biometricLock ? colors.primaryBright : colors.textMuted}
          />
        </Surface>
        <ActionRow icon="log-out-outline" title="Clear this device session" detail="Sign out, revoke this session, and remove saved access tokens from this device." onPress={async () => { await logout(); router.replace("/login"); }} />
      </FadeIn>

      <FadeIn delay={160}>
        <Eyebrow style={{ marginBottom: spacing.sm, marginTop: spacing.lg }}>Active Sessions</Eyebrow>
        {(sessions ?? []).map((session) => (
          <Surface key={session.id} style={{ marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md, opacity: session.revoked_at ? 0.55 : 1 }}>
            <Ionicons name={session.revoked_at ? "close-circle-outline" : "desktop-outline"} size={22} color={session.revoked_at ? colors.textMuted : colors.primaryBright} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "800" }} numberOfLines={1}>{session.user_agent || "Unknown device"}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {session.ip_address || "No IP"} · Last used {new Date(session.last_used_at).toLocaleString()}
              </Text>
            </View>
            {!session.revoked_at && (
              <Pressable onPress={() => revokeSession.mutate(session.id)} style={{ padding: spacing.sm }}>
                <Ionicons name="ban-outline" size={20} color={colors.critical} />
              </Pressable>
            )}
          </Surface>
        ))}
        {!(sessions ?? []).length && <Text style={{ color: colors.textMuted, marginBottom: spacing.sm }}>No active sessions found.</Text>}

        <Eyebrow style={{ marginBottom: spacing.sm, marginTop: spacing.lg }}>Registered Devices</Eyebrow>
        {(devices ?? []).map((device) => (
          <Surface key={device.id} style={{ marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md, opacity: device.revoked_at ? 0.55 : 1 }}>
            <Ionicons name={device.platform === "ios" ? "phone-portrait-outline" : "logo-android"} size={22} color={device.revoked_at ? colors.textMuted : colors.primaryBright} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>{device.label || `${device.platform.toUpperCase()} Device`}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                Last seen {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "never"}
              </Text>
            </View>
            {!device.revoked_at && (
              <Pressable onPress={() => revokeDevice.mutate(device.id)} style={{ padding: spacing.sm }}>
                <Ionicons name="ban-outline" size={20} color={colors.critical} />
              </Pressable>
            )}
          </Surface>
        ))}
        {!(devices ?? []).length && <Text style={{ color: colors.textMuted }}>No registered push devices found.</Text>}
      </FadeIn>

      <FadeIn delay={180}>
        <Eyebrow style={{ marginBottom: spacing.sm, marginTop: spacing.lg }}>Danger Zone</Eyebrow>
        <Button label={deleting ? "Deleting..." : "Delete Account"} icon="warning-outline" variant="danger" loading={deleting} onPress={confirmDelete} />
      </FadeIn>
    </ScrollView>
  );
}
