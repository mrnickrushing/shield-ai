import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";

import { Notification, ShieldAPI } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

function NotifItem({ item, onPress }: { item: Notification; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: item.is_read ? colors.bg : colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
      }}
    >
      {!item.is_read && (
        <View style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: colors.primary, marginTop: 5,
        }} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 2 }}>{item.title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={2}>{item.body}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
          {new Date(item.created_at).toLocaleString()}
        </Text>
      </View>
    </Pressable>
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

  const markRead = useMutation({
    mutationFn: (id: string) => ShieldAPI.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => ShieldAPI.markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handlePress = (item: Notification) => {
    if (!item.is_read) markRead.mutate(item.id);
    if (item.scan_id) router.push(`/result?id=${item.scan_id}`);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primaryBright} />
      </View>
    );
  }

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {unreadCount > 0 && (
        <Pressable
          onPress={() => markAllRead.mutate()}
          style={{ padding: spacing.md, alignItems: "flex-end" }}
        >
          <Text style={{ color: colors.primary, fontWeight: "600" }}>Mark all as read</Text>
        </Pressable>
      )}
      <FlatList
        data={notifications ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: spacing.md, paddingTop: unreadCount > 0 ? 0 : spacing.md }}
        renderItem={({ item }) => <NotifItem item={item} onPress={() => handlePress(item)} />}
        ListEmptyComponent={
          <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: spacing.xl }}>
            No notifications yet.
          </Text>
        }
      />
    </View>
  );
}
