import * as Notifications from "expo-notifications";
import { reloadAsync, useUpdates } from "expo-updates";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";

import { AppLockGate } from "@/components/AppLockGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LiveAlertBridge } from "@/components/LiveAlertBridge";
import { installCrashReporter } from "@/lib/crashReporter";
import { installGlobalFontScaling, setLargeTextMode } from "@/lib/fontScale";
import { registerDeviceForPush } from "@/lib/notifications";
import { addCustomerInfoListener, configureRevenueCat, getCustomerInfo, hasPremium } from "@/lib/revenuecat";
import { useAuth } from "@/state/auth";
import { colors } from "@/theme/theme";

// Hook the global JS error handler before anything else can throw.
installCrashReporter();

// Patch Text scaling before any screen renders so the baseline bump applies
// from first paint.
installGlobalFontScaling();

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

export default function RootLayout() {
  const hydrate = useAuth((s) => s.hydrate);
  const user = useAuth((s) => s.user);
  useEffect(() => { hydrate(); }, [hydrate]);

  // Apply the user's Large Text preference app-wide. Set during render (not in
  // an effect) so the correct scale is in place before first paint — otherwise
  // preference-enabled users would flash the base scale. Idempotent: it only
  // assigns a module-level primitive. Screens pick up a later toggle as they
  // render (navigating after the toggle re-mounts the target).
  setLargeTextMode(user?.large_text_mode ?? false);

  const { isUpdatePending } = useUpdates();
  useEffect(() => {
    if (!__DEV__ && isUpdatePending) {
      reloadAsync().catch(() => {});
    }
  }, [isUpdatePending]);

  useEffect(() => {
    if (!user?.id) return;
    registerDeviceForPush({ requestPermission: false }).catch(() => {});
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
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <AppLockGate>
          <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, contentStyle: { backgroundColor: colors.bg }, headerShadowVisible: false }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="reveal" options={{ title: "Check Your Exposure", headerShown: false }} />
            <Stack.Screen name="paywall" options={{ title: "Start Protection", headerShown: false }} />
            <Stack.Screen name="coach" options={{ title: "Scam Coach", headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="result" options={{ title: "Risk Report", headerShown: false }} />
            <Stack.Screen name="profile" options={{ title: "Profile", headerShown: false }} />
            <Stack.Screen name="privacy" options={{ title: "Privacy & Data" }} />
            <Stack.Screen name="recovery" options={{ title: "Scam Recovery", headerShown: false }} />
            <Stack.Screen name="incident" options={{ title: "Recovery Case" }} />
            <Stack.Screen name="education" options={{ title: "Education Center" }} />
            <Stack.Screen name="lesson" options={{ title: "Lesson" }} />
            <Stack.Screen name="family" options={{ title: "Family Protection" }} />
            <Stack.Screen name="community" options={{ title: "Community Intel" }} />
            <Stack.Screen name="call-protection" options={{ title: "Call & Text Protection" }} />
            <Stack.Screen name="notifications" options={{ title: "Notifications", headerShown: false }} />
            <Stack.Screen name="notification-settings" options={{ title: "Notification Settings", headerShown: false }} />
            <Stack.Screen name="identity" options={{ title: "Identity Protection", headerShown: false }} />
            <Stack.Screen name="exposure" options={{ title: "Data Broker Exposure" }} />
            <Stack.Screen name="browser" options={{ title: "Safe Browser", headerShown: false }} />
            <Stack.Screen name="share" options={{ title: "Report a Scam" }} />
            <Stack.Screen name="developer" options={{ title: "Developer" }} />
            <Stack.Screen name="labs" options={{ title: "Shield Labs" }} />
            <Stack.Screen name="report" options={{ title: "Protection Report" }} />
            <Stack.Screen name="protection" options={{ title: "Protection Checklist" }} />
            <Stack.Screen name="vertical/[key]" options={{ title: "Shield Labs" }} />
          </Stack>
          <LiveAlertBridge />
        </AppLockGate>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
