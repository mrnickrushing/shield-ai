import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";

import { useAuth } from "@/state/auth";
import { colors } from "@/theme/theme";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function RootLayout() {
  const hydrate = useAuth((s) => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);

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
        <Stack.Screen name="recovery" options={{ title: "Scam Recovery" }} />
        <Stack.Screen name="incident" options={{ title: "Recovery Case" }} />
        <Stack.Screen name="education" options={{ title: "Education Center" }} />
        <Stack.Screen name="lesson" options={{ title: "Lesson" }} />
        <Stack.Screen name="family" options={{ title: "Family Protection" }} />
        <Stack.Screen name="community" options={{ title: "Community Intel" }} />
        <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
        <Stack.Screen name="identity" options={{ title: "Identity Protection" }} />
        <Stack.Screen name="browser" options={{ title: "Safe Browser", headerShown: false }} />
        <Stack.Screen name="share" options={{ title: "Report a Scam" }} />
        <Stack.Screen name="developer" options={{ title: "Developer" }} />
      </Stack>
    </QueryClientProvider>
  );
}
