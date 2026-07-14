import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, FadeIn, Surface } from "@/components/ui";
import { Notification, ShieldAPI } from "@/lib/api";
import { colors, spacing } from "@/theme/theme";

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

  const clearNotification = useMutation({
    mutationFn: (id: string) => ShieldAPI.deleteNotification(id),
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

  const header = (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={22} color={colors.primaryBright} /></Pressable>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>Security Alerts Center</Text>
        <Ionicons name="person-circle-outline" size={23} color={colors.textDim} />
      </View>
      <View style={{ flexDirection: "row", height: 34, backgroundColor: colors.surface, borderRadius: 9, padding: 3, marginBottom: 14 }}>
        {["All", "Critical", "Info"].map((label, index) => (
          <View key={label} style={{ flex: 1, borderRadius: 7, backgroundColor: index === 0 ? colors.primaryBright : "transparent", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: index === 0 ? colors.bg : colors.textMuted, fontSize: 11, fontWeight: "800" }}>{label}</Text>
          </View>
        ))}
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
        data={notifications ?? []}
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
            No notifications yet.
          </Text>
        }
      />
    </View>
  );
}
