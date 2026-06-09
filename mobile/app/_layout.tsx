import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform } from "react-native";

import { useAuth } from "@/state/auth";
import { colors } from "@/theme/theme";

const queryClient = new QueryClient();

async function registerForPushNotifications() {
  try {
    // Dynamically import so the module is optional at runtime
    const Notifications = await import("expo-notifications");

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    // Only real devices return a meaningful Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
    if (!tokenData?.data) return;

    const { ShieldAPI } = await import("@/lib/api");
    const platform = Platform.OS === "ios" ? "ios" : "android";
    await ShieldAPI.registerDevice(tokenData.data, platform);
  } catch {
    // Notification setup is best-effort — never crash the app
  }
}

export default function RootLayout() {
  const hydrate = useAuth((s) => s.hydrate);
  const hydrated = useAuth((s) => s.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated) {
      registerForPushNotifications();
    }
  }, [hydrated]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "Sign In" }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="result" options={{ title: "Risk Report" }} />
        <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
        <Stack.Screen name="share" options={{ title: "Analyze Shared Content" }} />
      </Stack>
    </QueryClientProvider>
  );
}
