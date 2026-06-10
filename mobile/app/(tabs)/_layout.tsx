import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { Tabs, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import AppTour from "@/components/AppTour";
import { colors } from "@/theme/theme";

export default function TabsLayout() {
  const router = useRouter();
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    // Show tour once on first ever login (any auth method)
    SecureStore.getItemAsync("hasSeenTour").then((val) => {
      if (!val) setShowTour(true);
    });
  }, []);

  const handleTourDone = async () => {
    await SecureStore.setItemAsync("hasSeenTour", "true");
    setShowTour(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.primaryBright,
          tabBarInactiveTintColor: colors.textMuted,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="shield-checkmark-outline" size={size} color={color} />
            ),
            headerRight: () => (
              <Pressable onPress={() => router.push("/profile")} style={{ marginRight: 16 }} hitSlop={8}>
                <Ionicons name="person-circle-outline" size={26} color={colors.textMuted} />
              </Pressable>
            ),
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: "Scan",
            tabBarIcon: ({ color, size }) => <Ionicons name="scan-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="protect"
          options={{
            title: "Protect",
            tabBarIcon: ({ color, size }) => <Ionicons name="lock-closed-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "History",
            tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
          }}
        />
      </Tabs>

      <AppTour visible={showTour} onDone={handleTourDone} />
    </View>
  );
}
