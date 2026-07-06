import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { reloadAsync, useUpdates } from "expo-updates";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform } from "react-native";

import { LiveAlertBridge } from "@/components/LiveAlertBridge";
import { ShieldAPI } from "@/lib/api";
import { addCustomerInfoListener, configureRevenueCat, getCustomerInfo, hasPremium } from "@/lib/revenuecat";
import { useAuth } from "@/state/auth";
import { colors } from "@/theme/theme";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerDeviceForPush() {
  if (Platform.OS === "web") return;
  if (!Constants.isDevice) return;

  const permission = await Notifications.getPermissionsAsync();
  let finalStatus = permission.status;
  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }
  if (finalStatus !== "granted") return;

  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  await ShieldAPI.registerDevice(
    tokenResponse.data,
    Platform.OS === "ios" ? "ios" : "android"
  );
}

export default function RootLayout() {
  const hydrate = useAuth((s) => s.hydrate);
  const user = useAuth((s) => s.user);
  useEffect(() => { hydrate(); }, [hydrate]);

  const { isUpdatePending } = useUpdates();
  useEffect(() => {
    if (!__DEV__ && isUpdatePending) {
      reloadAsync().catch(() => {});
    }
  }, [isUpdatePending]);

  useEffect(() => {
    if (!user?.id) return;
    registerDeviceForPush().catch(() => {});
  }, [user?.id]);

  const setRcPremium = useAuth((s) => s.setRcPremium);
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        await configureRevenueCat(user.id);
        addCustomerInfoListener((info) => setRcPremium(hasPremium(info)));
        setRcPremium(hasPremium(await getCustomerInfo()));
      } catch {
        // Entitlements fall back to the backend's is_premium flag.
      }
    })();
  }, [user?.id, setRcPremium]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, contentStyle: { backgroundColor: colors.bg }, headerShadowVisible: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="paywall" options={{ title: "Upgrade to Premium", headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="result" options={{ title: "Risk Report" }} />
        <Stack.Screen name="profile" options={{ title: "Profile" }} />
        <Stack.Screen name="privacy" options={{ title: "Privacy & Data" }} />
        <Stack.Screen name="recovery" options={{ title: "Scam Recovery" }} />
        <Stack.Screen name="incident" options={{ title: "Recovery Case" }} />
        <Stack.Screen name="education" options={{ title: "Education Center" }} />
        <Stack.Screen name="lesson" options={{ title: "Lesson" }} />
        <Stack.Screen name="family" options={{ title: "Family Protection" }} />
        <Stack.Screen name="community" options={{ title: "Community Intel" }} />
        <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
        <Stack.Screen name="identity" options={{ title: "Identity Protection" }} />
        <Stack.Screen name="exposure" options={{ title: "Data Broker Exposure" }} />
        <Stack.Screen name="browser" options={{ title: "Safe Browser", headerShown: false }} />
        <Stack.Screen name="share" options={{ title: "Report a Scam" }} />
        <Stack.Screen name="developer" options={{ title: "Developer" }} />
        <Stack.Screen name="labs" options={{ title: "Shield Labs" }} />
        <Stack.Screen name="vertical/[key]" options={{ title: "Shield Labs" }} />
      </Stack>
      <LiveAlertBridge />
    </QueryClientProvider>
  );
}
