import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandWordmark } from "@/components/BrandWordmark";
import { GlowBackground } from "@/components/GlowBackground";
import { Button, Surface } from "@/components/ui";
import { NotificationPreferences, ShieldAPI } from "@/lib/api";
import {
  getNotificationPermissionState,
  NotificationPermissionState,
  registerDeviceForPush,
} from "@/lib/notifications";
import { colors, glow, radius, spacing, type, withAlpha } from "@/theme/theme";

const SEVERITIES: {
  value: NotificationPreferences["minimum_severity"];
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "low", label: "Low+" },
  { value: "suspicious", label: "Suspicious+" },
  { value: "high", label: "High+" },
  { value: "critical", label: "Critical" },
];

const TOPICS = [
  { key: "breach", label: "Data breaches", icon: "key-outline" },
  { key: "impersonation", label: "Impersonation", icon: "people-outline" },
  { key: "account", label: "Account security", icon: "lock-closed-outline" },
  { key: "family", label: "Family alerts", icon: "heart-outline" },
  { key: "community", label: "Community intel", icon: "globe-outline" },
] as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function ToggleRow({
  icon,
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View
      style={{
        minHeight: 76,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 13,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primaryDim,
          borderWidth: 1,
          borderColor: withAlpha(colors.primaryBright, "35"),
        }}
      >
        <Ionicons name={icon} size={20} color={colors.primaryBright} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800", marginBottom: 3 }}>
          {label}
        </Text>
        <Text style={{ color: colors.textDim, fontSize: 13, lineHeight: 18 }}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.borderHi, true: colors.primary }}
        thumbColor={value ? colors.text : colors.textDim}
        ios_backgroundColor={colors.borderHi}
      />
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ ...type.eyebrow, color: colors.textDim, marginBottom: 9, marginTop: 22 }}>
      {children}
    </Text>
  );
}

function permissionCopy(state: NotificationPermissionState) {
  if (state === "granted") {
    return {
      label: "Enabled on this device",
      detail: "Shield AI can deliver the alerts you choose below.",
      color: colors.safe,
      icon: "checkmark-circle" as const,
    };
  }
  if (state === "denied") {
    return {
      label: "Blocked by device settings",
      detail: "Turn on notifications in your device settings to receive push alerts.",
      color: colors.suspicious,
      icon: "warning" as const,
    };
  }
  if (state === "unsupported") {
    return {
      label: "Available on your mobile device",
      detail: "Notification permission can only be managed in the installed Shield AI app.",
      color: colors.textDim,
      icon: "phone-portrait-outline" as const,
    };
  }
  return {
    label: "Not enabled on this device",
    detail: "Allow Shield AI to notify you when your protection needs attention.",
    color: colors.primaryBright,
    icon: "notifications-outline" as const,
  };
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return "Something went wrong. Please try again.";
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [draftOverride, setDraftOverride] = useState<NotificationPreferences | null>(null);
  const [dirty, setDirty] = useState(false);
  const [permission, setPermission] = useState<NotificationPermissionState>("undetermined");
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const preferencesQuery = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => ShieldAPI.getNotificationPreferences(),
  });

  const draft = draftOverride ?? preferencesQuery.data ?? null;

  const refreshPermission = async () => {
    try {
      setPermission(await getNotificationPermissionState());
    } catch {
      setPermission("unsupported");
    }
  };

  useEffect(() => {
    getNotificationPermissionState().then(setPermission, () => setPermission("unsupported"));
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshPermission();
    });
    return () => subscription.remove();
  }, []);

  const saveMutation = useMutation({
    mutationFn: (payload: NotificationPreferences) => ShieldAPI.updateNotificationPreferences(payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(["notification-preferences"], saved);
      setDraftOverride(saved);
      setDirty(false);
      setMessage({ tone: "success", text: "Your alert preferences are saved." });
    },
    onError: (error) => setMessage({ tone: "error", text: errorMessage(error) }),
  });

  const updateDraft = (patch: Partial<NotificationPreferences>) => {
    setDraftOverride((current) => {
      const base = current ?? preferencesQuery.data;
      return base ? { ...base, ...patch } : current;
    });
    setDirty(true);
    setMessage(null);
  };

  const requestDevicePermission = async () => {
    setPermissionBusy(true);
    setMessage(null);
    try {
      const state = await registerDeviceForPush({ requestPermission: true });
      setPermission(state);
      if (state === "granted") {
        updateDraft({ push_enabled: true });
      } else if (state === "denied") {
        setMessage({
          tone: "error",
          text: "Push alerts are blocked by your device. Open device settings to enable them.",
        });
      }
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setPermissionBusy(false);
    }
  };

  const handlePushChange = async (enabled: boolean) => {
    updateDraft({ push_enabled: enabled });
    if (enabled && permission === "undetermined") await requestDevicePermission();
  };

  const handlePermissionAction = async () => {
    if (permission === "undetermined") {
      await requestDevicePermission();
      return;
    }
    try {
      await Linking.openSettings();
    } catch {
      setMessage({ tone: "error", text: "Device settings could not be opened." });
    }
  };

  const save = () => {
    if (!draft) return;
    if (
      draft.quiet_hours_enabled &&
      (!TIME_PATTERN.test(draft.quiet_hours_start) || !TIME_PATTERN.test(draft.quiet_hours_end))
    ) {
      setMessage({ tone: "error", text: "Quiet hours must use 24-hour HH:MM format." });
      return;
    }
    const { updated_at: _updatedAt, ...payload } = draft;
    saveMutation.mutate(payload);
  };

  const systemState = permissionCopy(permission);

  if (preferencesQuery.isLoading || !draft) {
    if (preferencesQuery.isError) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: spacing.lg }}>
          <GlowBackground />
          <Ionicons name="cloud-offline-outline" size={34} color={colors.suspicious} style={{ alignSelf: "center" }} />
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 12 }}>
            Settings didn’t load
          </Text>
          <Text style={{ color: colors.textDim, textAlign: "center", lineHeight: 20, marginVertical: 12 }}>
            Check your connection and try again.
          </Text>
          <Button label="Try Again" icon="refresh" onPress={() => void preferencesQuery.refetch()} />
          <Button label="Go Back" variant="ghost" onPress={() => router.back()} style={{ marginTop: 8 }} />
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}>
        <GlowBackground />
        <ActivityIndicator color={colors.primaryBright} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GlowBackground centerY={0.12} />
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: spacing.lg,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.glass }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.primaryBright} />
        </Pressable>
        <BrandWordmark size={22} />
        <Pressable
          onPress={() => router.push("/notifications")}
          accessibilityRole="button"
          accessibilityLabel="Open security alerts"
          hitSlop={10}
          style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.glass }}
        >
          <Ionicons name="notifications-outline" size={21} color={colors.primaryBright} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 32 }}
      >
        <Text style={{ ...type.display, fontSize: 29, marginTop: 8 }}>Notification Settings</Text>
        <Text style={{ ...type.body, color: colors.textDim, marginTop: 7, marginBottom: 18 }}>
          Choose how Shield AI reaches you when your digital protection needs attention.
        </Text>

        <Surface accent={systemState.color} glow={systemState.color} style={{ backgroundColor: colors.glassDeep }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 13 }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 15,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(systemState.color, "18"),
                borderWidth: 1,
                borderColor: withAlpha(systemState.color, "55"),
                ...glow(systemState.color, "sm"),
              }}
            >
              <Ionicons name={systemState.icon} size={24} color={systemState.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: systemState.color, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 }}>
                DEVICE PERMISSION
              </Text>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900", marginTop: 4 }}>
                {systemState.label}
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 5 }}>
                {systemState.detail}
              </Text>
            </View>
          </View>
          {permission !== "unsupported" ? (
            <Button
              label={permission === "undetermined" ? "Enable on This Device" : "Open Device Settings"}
              icon={permission === "undetermined" ? "notifications" : "open-outline"}
              variant={permission === "granted" ? "secondary" : "primary"}
              onPress={() => void handlePermissionAction()}
              loading={permissionBusy}
              style={{ marginTop: 16 }}
            />
          ) : null}
        </Surface>

        <SectionLabel>DELIVERY CHANNELS</SectionLabel>
        <Surface style={{ paddingVertical: 2 }}>
          <ToggleRow
            icon="notifications-outline"
            label="Push notifications"
            description="Immediate alerts on this device."
            value={draft.push_enabled}
            onValueChange={(value) => void handlePushChange(value)}
            disabled={saveMutation.isPending || permissionBusy}
          />
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <ToggleRow
            icon="mail-outline"
            label="Email alerts"
            description="Protection updates sent to your account email."
            value={draft.email_enabled}
            onValueChange={(value) => updateDraft({ email_enabled: value })}
            disabled={saveMutation.isPending}
          />
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <ToggleRow
            icon="pulse-outline"
            label="Proactive monitoring"
            description="Watch protected identities and notify you of changes."
            value={draft.proactive_monitoring}
            onValueChange={(value) => updateDraft({ proactive_monitoring: value })}
            disabled={saveMutation.isPending}
          />
        </Surface>

        <SectionLabel>ALERT PRIORITY</SectionLabel>
        <Surface>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>Minimum severity</Text>
          <Text style={{ color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 13 }}>
            Only notify you at this risk level or higher.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {SEVERITIES.map((severity) => {
              const active = draft.minimum_severity === severity.value;
              return (
                <Pressable
                  key={severity.value}
                  onPress={() => updateDraft({ minimum_severity: severity.value })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={{
                    minHeight: 38,
                    justifyContent: "center",
                    paddingHorizontal: 13,
                    borderRadius: radius.pill,
                    backgroundColor: active ? colors.primary : colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: active ? colors.primaryBright : colors.borderHi,
                  }}
                >
                  <Text style={{ color: active ? colors.bg : colors.textDim, fontSize: 13, fontWeight: "800" }}>
                    {severity.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Surface>

        <SectionLabel>ALERT TOPICS</SectionLabel>
        <Surface style={{ paddingVertical: 2 }}>
          {TOPICS.map((topic, index) => (
            <React.Fragment key={topic.key}>
              {index > 0 ? <View style={{ height: 1, backgroundColor: colors.border }} /> : null}
              <ToggleRow
                icon={topic.icon}
                label={topic.label}
                description={
                  topic.key === "breach"
                    ? "New exposure involving monitored information."
                    : topic.key === "impersonation"
                      ? "Possible fake profiles or identity misuse."
                      : topic.key === "account"
                        ? "Security changes and account risks."
                        : topic.key === "family"
                          ? "Important activity from protected family members."
                          : "Relevant scam patterns reported nearby."
                }
                value={draft.topics[topic.key] ?? false}
                onValueChange={(value) =>
                  updateDraft({ topics: { ...draft.topics, [topic.key]: value } })
                }
                disabled={saveMutation.isPending}
              />
            </React.Fragment>
          ))}
        </Surface>

        <SectionLabel>QUIET HOURS</SectionLabel>
        <Surface>
          <ToggleRow
            icon="moon-outline"
            label="Use quiet hours"
            description="Pause non-critical alerts during your chosen window. Critical alerts still come through."
            value={draft.quiet_hours_enabled}
            onValueChange={(value) => updateDraft({ quiet_hours_enabled: value })}
            disabled={saveMutation.isPending}
          />
          {draft.quiet_hours_enabled ? (
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textDim, fontSize: 12, fontWeight: "800", marginBottom: 6 }}>START</Text>
                  <TextInput
                    value={draft.quiet_hours_start}
                    onChangeText={(value) => updateDraft({ quiet_hours_start: value })}
                    placeholder="22:00"
                    placeholderTextColor={colors.textMuted}
                    maxLength={5}
                    keyboardType="numbers-and-punctuation"
                    accessibilityLabel="Quiet hours start time in UTC"
                    style={{
                      height: 48,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.borderHi,
                      backgroundColor: colors.bg,
                      color: colors.text,
                      fontSize: 17,
                      fontWeight: "800",
                      textAlign: "center",
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textDim, fontSize: 12, fontWeight: "800", marginBottom: 6 }}>END</Text>
                  <TextInput
                    value={draft.quiet_hours_end}
                    onChangeText={(value) => updateDraft({ quiet_hours_end: value })}
                    placeholder="07:00"
                    placeholderTextColor={colors.textMuted}
                    maxLength={5}
                    keyboardType="numbers-and-punctuation"
                    accessibilityLabel="Quiet hours end time in UTC"
                    style={{
                      height: 48,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.borderHi,
                      backgroundColor: colors.bg,
                      color: colors.text,
                      fontSize: 17,
                      fontWeight: "800",
                      textAlign: "center",
                    }}
                  />
                </View>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
                Times use 24-hour UTC format.
              </Text>
            </View>
          ) : null}
        </Surface>

        {permission === "denied" && draft.push_enabled ? (
          <View style={{ flexDirection: "row", gap: 9, marginTop: 16, padding: 13, borderRadius: radius.md, backgroundColor: colors.suspiciousDim }}>
            <Ionicons name="warning-outline" size={19} color={colors.suspicious} />
            <Text style={{ color: colors.textDim, flex: 1, fontSize: 13, lineHeight: 19 }}>
              Push alerts are selected here, but your device is blocking delivery. Open device settings to finish enabling them.
            </Text>
          </View>
        ) : null}

        {message ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: 16,
              padding: 12,
              borderRadius: radius.md,
              backgroundColor: message.tone === "success" ? colors.safeDim : colors.criticalDim,
            }}
          >
            <Ionicons
              name={message.tone === "success" ? "checkmark-circle" : "alert-circle"}
              size={19}
              color={message.tone === "success" ? colors.safe : colors.critical}
            />
            <Text style={{ flex: 1, color: colors.text, fontSize: 13, lineHeight: 18 }}>{message.text}</Text>
          </View>
        ) : null}

        <Button
          label={dirty ? "Save Changes" : "Preferences Saved"}
          icon={dirty ? "checkmark" : "checkmark-circle"}
          onPress={save}
          disabled={!dirty}
          loading={saveMutation.isPending}
          style={{ marginTop: 20 }}
        />
        <Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 10 }}>
          Critical safety alerts may override quiet hours.
        </Text>
      </ScrollView>
    </View>
  );
}
