import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, FadeIn, Surface } from "@/components/ui";
import { Notification, ShieldAPI } from "@/lib/api";
import { colors, spacing } from "@/theme/theme";

type AlertFilter = "All" | "Critical" | "Info";

// Scan notifications encode the verdict in the title ("… — <level> risk"), so
// classify from that, never the body — a *safe* scan's explanation often
// contains words like "suspicious" or "scam" and must not be miscounted as
// critical. Non-scan alerts (breach, fraud) are matched on the title alone.
const TITLE_THREAT_PATTERN = /critical|high risk|suspicious|breach|fraud|scam|exposed|malicious|urgent|warning/i;

function isCriticalAlert(item: Notification): boolean {
  const level = /—\s*(safe|low|suspicious|high|critical)\s+risk/i.exec(item.title)?.[1]?.toLowerCase();
  if (level) return level === "suspicious" || level === "high" || level === "critical";
  return TITLE_THREAT_PATTERN.test(item.title);
}

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

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<AlertFilter>("All");

  const { data: notifications, isLoading, isError, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => ShieldAPI.listNotifications(),
    staleTime: 10_000,
  });
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

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;
  const visible = useMemo(
    () =>
      (notifications ?? []).filter((n) =>
        filter === "All" ? true : filter === "Critical" ? isCriticalAlert(n) : !isCriticalAlert(n)
      ),
    [notifications, filter]
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primaryBright} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: spacing.lg }}>
        <Ionicons name="cloud-offline-outline" size={34} color={colors.suspicious} style={{ alignSelf: "center" }} />
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 12 }}>
          Alerts didn’t load
        </Text>
        <Text style={{ color: colors.textMuted, textAlign: "center", marginVertical: 12 }}>
          Check your connection and try again.
        </Text>
        <Button label="Try Again" icon="refresh" onPress={() => void refetch()} />
        <Button label="Go Back" variant="ghost" onPress={() => router.back()} style={{ marginTop: 8 }} />
      </View>
    );
  }

  const header = (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={22} color={colors.primaryBright} /></Pressable>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>Security Alerts Center</Text>
        <Pressable
          onPress={() => router.push("/notification-settings" as never)}
          accessibilityRole="button"
          accessibilityLabel="Open notification settings"
          hitSlop={12}
        >
          <Ionicons name="settings-outline" size={22} color={colors.primaryBright} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", height: 34, backgroundColor: colors.surface, borderRadius: 9, padding: 3, marginBottom: 14 }}>
        {(["All", "Critical", "Info"] as AlertFilter[]).map((label) => {
          const active = filter === label;
          return (
            <Pressable
              key={label}
              onPress={() => setFilter(label)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={{ flex: 1, borderRadius: 7, backgroundColor: active ? colors.primaryBright : "transparent", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: active ? colors.bg : colors.textMuted, fontSize: 11, fontWeight: "800" }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>LATEST ALERTS</Text>
        {unreadCount > 0 ? <Button label="Mark all read" size="sm" variant="secondary" onPress={() => markAllRead.mutate()} loading={markAllRead.isPending} /> : null}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={visible}
        keyExtractor={(n) => n.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: spacing.md, paddingTop: insets.top + 8, paddingBottom: spacing.xxl }}
        renderItem={({ item, index }) => (
          <FadeIn delay={Math.min(index, 6) * 40}>
            <NotifItem item={item} onPress={() => handlePress(item)} onClear={() => clearNotification.mutate(item.id)} />
          </FadeIn>
        )}
        ListEmptyComponent={
          <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: spacing.lg }}>
            {filter === "All" ? "No notifications yet." : `No ${filter.toLowerCase()} alerts.`}
          </Text>
        }
      />
    </View>
  );
}
