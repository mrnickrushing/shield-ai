import * as SecureStore from "expo-secure-store";
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/state/auth";
import { colors } from "@/theme/theme";

export default function Index() {
  const { user, hydrated } = useAuth();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [seenOnboarding, setSeenOnboarding] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync("hasSeenOnboarding").then((val) => {
      setSeenOnboarding(val === "true");
      setOnboardingChecked(true);
    });
  }, []);

  if (!hydrated || !onboardingChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.primaryBright} size="large" />
      </View>
    );
  }

  if (!seenOnboarding) return <Redirect href="/onboarding" />;
  if (!user) return <Redirect href="/login" />;
  return <Redirect href="/(tabs)/dashboard" />;
}
