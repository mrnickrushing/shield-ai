import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/state/auth";
import { colors } from "@/theme/theme";

// Splash / routing gate: send to tabs if authed, else to login.
export default function Index() {
  const { user, hydrated } = useAuth();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.primaryBright} size="large" />
      </View>
    );
  }
  return <Redirect href={user ? "/(tabs)/dashboard" : "/login"} />;
}
