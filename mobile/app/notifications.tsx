import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, FlatList, Pressable, Switch, Text, View } from "react-native";

import { Button, Eyebrow, FadeIn, Surface } from "@/components/ui";
import { Notification, ShieldAPI } from "@/lib/api";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";

type NotificationSettings = {
  push: boolean;
  email: boolean;
  proactiveMonitoring: boolean;
  quietHours: boolean;
  severity: "all" | "suspicious" | "high";
  topics: Record<"breach" | "impersonation" | "account" | "family" | "community", boolean>;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  push: true,
  email: false,
  proactiveMonitoring: true,
  quietHours: true,
  severity: "suspicious",
  topics: {
    breach: true,
    impersonation: true,
    account: true,
    family: true,
    community: false,
  },
};

const TOPICS: { key: keyof NotificationSettings["topics"]; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "breach", label: "Data breaches", description: "Passwords, emails, or personal data found in breaches.", icon: "key-outline" },
  { key: "impersonation", label: "Impersonation", description: "Lookalike domains, fake profiles, and brand abuse.", icon: "person-circle-outline" },
  { key: "account", label: "Account risk", description: "High-risk scans and recovery follow-ups.", icon: "shield-half-outline" },
  { key: "family", label: "Family alerts", description: "Trusted-contact and shared safety activity.", icon: "people-outline" },
  { key: "community", label: "Community intel", description: "Analyst-approved scam patterns in your watch areas.", icon: "radio-outline" },
];

function NotifItem({ item, onPress, onClear }: { item: Notification; onPress: () => void; onClear: () => void }) {
  return (
    <Surface
      onPress={onPress}
      style={{
        backgroundColor: item.is_read ? colors.bg : colors.surface,
        marginBottom: spacing.sm,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
      }}
    >
      {!item.is_read && (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 5 }} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 2 }}>{item.title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={2}>{item.body}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
          {new Date(item.created_at).toLocaleString()}
        </Text>
      </View>
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          onClear();
        }}
        hitSlop={10}
        style={{ padding: 4 }}
      >
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </Pressable>
    </Surface>
  );
}

function ToggleRow({
  icon,
  title,
  detail,
  value,
  onValueChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <Surface style={{ marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <View style={{ width: 38, height: 38, borderRadius: radius.md, backgroundColor: withAlpha(colors.primaryBright, "1a"), alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={19} color={colors.primaryBright} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={value ? colors.primaryBright : colors.textMuted}
      />
    </Surface>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => ShieldAPI.listNotifications(),
    staleTime: 10_000,
  });
  const { data: notificationPreferences, isLoading: prefsLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => ShieldAPI.getNotificationPreferences(),
    staleTime: 30_000,
  });

  const settings: NotificationSettings = notificationPreferences
    ? {
        push: notificationPreferences.push_enabled,
        email: notificationPreferences.email_enabled,
        proactiveMonitoring: notificationPreferences.proactive_monitoring,
        quietHours: notificationPreferences.quiet_hours_enabled,
        severity: notificationPreferences.minimum_severity === "critical" || notificationPreferences.minimum_severity === "low" ? "high" : notificationPreferences.minimum_severity,
        topics: { ...DEFAULT_SETTINGS.topics, ...(notificationPreferences.topics as NotificationSettings["topics"]) },
      }
    : DEFAULT_SETTINGS;

  const savePreferences = useMutation({
    mutationFn: (next: NotificationSettings) =>
      ShieldAPI.updateNotificationPreferences({
        push_enabled: next.push,
        email_enabled: next.email,
        proactive_monitoring: next.proactiveMonitoring,
        quiet_hours_enabled: next.quietHours,
        quiet_hours_start: notificationPreferences?.quiet_hours_start ?? "22:00",
        quiet_hours_end: notificationPreferences?.quiet_hours_end ?? "07:00",
        minimum_severity: next.severity,
        topics: next.topics,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-preferences"] }),
  });

  const saveSettings = (next: NotificationSettings) => savePreferences.mutate(next);

  const markRead = useMutation({
    mutationFn: (id: string) => ShieldAPI.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => ShieldAPI.markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const clearNotification = useMutation({
    mutationFn: (id: string) => ShieldAPI.deleteNotification(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handlePress = (item: Notification) => {
    if (!item.is_read) markRead.mutate(item.id);
    if (item.scan_id) router.push(`/result?id=${item.scan_id}`);
  };

  if (isLoading || prefsLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primaryBright} />
      </View>
    );
  }

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;

  const header = (
    <View>
      <FadeIn>
        <Surface accent={colors.primaryBright} style={{ marginBottom: spacing.lg }}>
          <Eyebrow style={{ marginBottom: spacing.sm }}>GUARDIAN ALERTS</Eyebrow>
          <Text style={{ color: colors.text, fontSize: 25, fontWeight: "900", marginBottom: spacing.sm }}>Monitoring controls</Text>
          <Text style={{ color: colors.textMuted, lineHeight: 21 }}>
            Tune which risks Shield AI watches, how it reaches you, and when alerts should stay quiet.
          </Text>
        </Surface>
      </FadeIn>

      <FadeIn delay={60}>
        <Eyebrow style={{ marginBottom: spacing.sm }}>Channels</Eyebrow>
        <ToggleRow icon="phone-portrait-outline" title="Push alerts" detail="Immediate alerts on this device." value={settings.push} onValueChange={(push) => saveSettings({ ...settings, push })} />
        <ToggleRow icon="mail-outline" title="Email digest" detail="Send important risk summaries to your account email." value={settings.email} onValueChange={(email) => saveSettings({ ...settings, email })} />
        <ToggleRow icon="pulse-outline" title="Proactive monitoring" detail="Watch for recurring breach, impersonation, and account-risk signals." value={settings.proactiveMonitoring} onValueChange={(proactiveMonitoring) => saveSettings({ ...settings, proactiveMonitoring })} />
        <ToggleRow icon="moon-outline" title="Quiet hours" detail="Hold non-critical alerts overnight." value={settings.quietHours} onValueChange={(quietHours) => saveSettings({ ...settings, quietHours })} />
      </FadeIn>

      <FadeIn delay={100}>
        <Eyebrow style={{ marginBottom: spacing.sm, marginTop: spacing.lg }}>Minimum severity</Eyebrow>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
          {[
            { key: "all", label: "All" },
            { key: "suspicious", label: "Suspicious+" },
            { key: "high", label: "High+" },
          ].map((option) => {
            const selected = settings.severity === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => saveSettings({ ...settings, severity: option.key as NotificationSettings["severity"] })}
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  alignItems: "center",
                  backgroundColor: selected ? withAlpha(colors.primaryBright, "20") : colors.surface,
                  borderWidth: 1,
                  borderColor: selected ? colors.primaryBright : colors.border,
                }}
              >
                <Text style={{ color: selected ? colors.primaryBright : colors.textMuted, fontWeight: "800", fontSize: 13 }}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </FadeIn>

      <FadeIn delay={140}>
        <Eyebrow style={{ marginBottom: spacing.sm }}>Topics</Eyebrow>
        {TOPICS.map((topic) => (
          <ToggleRow
            key={topic.key}
            icon={topic.icon}
            title={topic.label}
            detail={topic.description}
            value={settings.topics[topic.key]}
            onValueChange={(value) => saveSettings({ ...settings, topics: { ...settings.topics, [topic.key]: value } })}
          />
        ))}
      </FadeIn>

      <FadeIn delay={180}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg, marginBottom: spacing.sm }}>
          <Eyebrow>Inbox</Eyebrow>
          {unreadCount > 0 && (
            <Button label="Mark all read" size="sm" variant="secondary" onPress={() => markAllRead.mutate()} loading={markAllRead.isPending} />
          )}
        </View>
      </FadeIn>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={notifications ?? []}
        keyExtractor={(n) => n.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
        renderItem={({ item, index }) => (
          <FadeIn delay={Math.min(index, 6) * 40}>
            <NotifItem item={item} onPress={() => handlePress(item)} onClear={() => clearNotification.mutate(item.id)} />
          </FadeIn>
        )}
        ListEmptyComponent={
          <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: spacing.lg }}>
            No notifications yet.
          </Text>
        }
      />
    </View>
  );
}
