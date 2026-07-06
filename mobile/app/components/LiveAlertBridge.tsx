import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { API_URL, Notification, ShieldAPI } from "@/lib/api";
import { useAuth } from "@/state/auth";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";

type LiveAlert = Pick<Notification, "id" | "title" | "body" | "scan_id" | "created_at">;

function newestUnread(items: Notification[], seen: Set<string>) {
  return items.find((item) => !item.is_read && !seen.has(item.id));
}

export function LiveAlertBridge() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((s) => s.user?.id);
  const [alert, setAlert] = useState<LiveAlert | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: alert ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [alert, opacity]);

  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let eventSource: EventSource | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const show = (next: LiveAlert) => {
      if (disposed || seenIds.current.has(next.id)) return;
      seenIds.current.add(next.id);
      setAlert(next);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setTimeout(() => setAlert((current) => (current?.id === next.id ? null : current)), 7000);
    };

    const startPolling = () => {
      const poll = async () => {
        try {
          const unread = await ShieldAPI.listNotifications(true);
          const next = newestUnread(unread, seenIds.current);
          if (next) show(next);
        } catch {}
      };
      poll();
      interval = setInterval(poll, 15000);
    };

    if (typeof EventSource !== "undefined") {
      try {
        eventSource = new EventSource(`${API_URL}/api/v1/monitoring/stream`);
        eventSource.addEventListener("notification", (event) => {
          try {
            show(JSON.parse((event as MessageEvent).data));
          } catch {}
        });
        eventSource.onerror = () => {
          eventSource?.close();
          if (!interval) startPolling();
        };
      } catch {
        startPolling();
      }
    } else {
      startPolling();
    }

    return () => {
      disposed = true;
      eventSource?.close();
      if (interval) clearInterval(interval);
    };
  }, [queryClient, userId]);

  if (!alert) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 58,
        left: spacing.md,
        right: spacing.md,
        opacity,
        zIndex: 1000,
      }}
    >
      <Pressable
        onPress={() => {
          setAlert(null);
          if (alert.scan_id) router.push(`/result?id=${alert.scan_id}`);
          else router.push("/notifications");
        }}
        style={{
          backgroundColor: colors.surfaceHigh,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: withAlpha(colors.primaryBright, "55"),
          padding: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          shadowColor: colors.primaryBright,
          shadowOpacity: 0.24,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: withAlpha(colors.primaryBright, "20"), alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.primaryBright} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }} numberOfLines={1}>{alert.title}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{alert.body}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}
