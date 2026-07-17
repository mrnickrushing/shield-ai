import * as Notifications from "expo-notifications";
import { reloadAsync, useUpdates } from "expo-updates";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, AppState, View } from "react-native";

import { AppLockGate } from "@/components/AppLockGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LiveAlertBridge } from "@/components/LiveAlertBridge";
import { installCrashReporter } from "@/lib/crashReporter";
import { installGlobalFontScaling, setLargeTextMode } from "@/lib/fontScale";
import { safeNotificationRoute } from "@/lib/notificationPolicy";
import { registerDeviceForPush } from "@/lib/notifications";
import { syncCallProtection } from "@/lib/callDirectorySync";
import { addCustomerInfoListener, configureRevenueCat, getCustomerInfo, hasPremium } from "@/lib/revenuecat";
import { syncSafariBlocklist } from "@/lib/safariBlocklistSync";
import { ShieldAPI } from "@/lib/api";
import { useAuth } from "@/state/auth";
import { colors } from "@/theme/theme";

// Hook the global JS error handler before anything else can throw.
installCrashReporter();

// Patch Text scaling before any screen renders so the baseline bump applies
// from first paint.
installGlobalFontScaling();

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
  const hydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => { hydrate(); }, [hydrate]);

  // A cache belongs to exactly one authenticated account. Replacing the
  // client on every account transition makes identical query keys safe and
  // prevents stale scans, contacts, or settings crossing the login boundary.
  const accountId = user?.id;
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000, meta: { accountId } } } }),
    [accountId]
  );
  const lastProtectionSync = useRef(0);

  useEffect(() => {
    if (!user?.id) {
      lastProtectionSync.current = 0;
      return;
    }
    const syncIfStale = async () => {
      if (Date.now() - lastProtectionSync.current < 6 * 60 * 60 * 1000) return;
      lastProtectionSync.current = Date.now();
      const [calls] = await Promise.allSettled([
        syncCallProtection(),
        syncSafariBlocklist(),
      ]);
      if (calls.status === "fulfilled" && calls.value.synced) {
        await ShieldAPI.recordExtensionEvent({
          extension_type: "call_directory",
          event_type: "synced",
          counts: { numbers_labeled: calls.value.count },
        }).catch(() => {});
        queryClient.invalidateQueries({ queryKey: ["protection-score"] });
      }
    };
    syncIfStale().catch(() => {});
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncIfStale().catch(() => {});
    });
    return () => subscription.remove();
  }, [queryClient, user?.id]);

  const isPublicRoute = pathname === "/" || pathname === "/login" || pathname === "/onboarding";
  const blockProtectedRoute = !hydrated || (!user && !isPublicRoute);
  useEffect(() => {
    if (hydrated && !user && !isPublicRoute) router.replace("/login");
  }, [hydrated, isPublicRoute, router, user]);

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

  useEffect(() => {
    if (!user?.id) return;
    const openNotification = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data ?? {};
      const requestedRoute = typeof data.route === "string"
        ? data.route
        : data.screen === "report"
          ? "/report"
          : null;
      const route = safeNotificationRoute(
        requestedRoute,
        typeof data.scan_id === "string" ? data.scan_id : null
      );
      router.push(route as any);
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(openNotification);
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openNotification(response);
    }).catch(() => {});
    return () => subscription.remove();
  }, [router, user?.id]);

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
        <View style={{ flex: 1 }} accessibilityElementsHidden={blockProtectedRoute} importantForAccessibility={blockProtectedRoute ? "no-hide-descendants" : "auto"}>
          {user ? <AppLockGate>
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
          </AppLockGate> : (
            <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, contentStyle: { backgroundColor: colors.bg }, headerShadowVisible: false }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
            </Stack>
          )}
          {user && <LiveAlertBridge />}
          {blockProtectedRoute && (
            <View style={{ position: "absolute", inset: 0, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }} accessibilityRole="progressbar" accessibilityLabel="Checking session">
              <ActivityIndicator color={colors.primaryBright} size="large" />
            </View>
          )}
        </View>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
