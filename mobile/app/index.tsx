import * as SecureStore from "expo-secure-store";
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { HAS_SEEN_REVEAL_KEY } from "@/reveal";
import { useAuth, useIsPremium } from "@/state/auth";
import { colors } from "@/theme/theme";

export default function Index() {
  const { user, hydrated } = useAuth();
  const isPremium = useIsPremium();
  const [flagsChecked, setFlagsChecked] = useState(false);
  const [seenOnboarding, setSeenOnboarding] = useState(false);
  const [seenReveal, setSeenReveal] = useState(false);

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync("hasSeenOnboarding"),
      SecureStore.getItemAsync(HAS_SEEN_REVEAL_KEY),
    ]).then(([onboarding, reveal]) => {
      setSeenOnboarding(onboarding === "true");
      setSeenReveal(reveal === "true");
      setFlagsChecked(true);
    });
  }, []);

  if (!hydrated || !flagsChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.primaryBright} size="large" />
      </View>
    );
  }

  if (!seenOnboarding) return <Redirect href="/onboarding" />;
  if (!user) return <Redirect href="/login" />;
  // Shield AI has no free tier — every account needs an active subscription
  // (or trial) before it can reach the app. New accounts see their live
  // breach exposure first ("the moment"), then the paywall.
  if (!isPremium) return <Redirect href={seenReveal ? "/paywall" : "/reveal"} />;
  return <Redirect href="/(tabs)/dashboard" />;
}
