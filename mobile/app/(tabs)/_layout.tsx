import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";

import AppTour from "@/components/AppTour";
import { colors } from "@/theme/theme";

export default function TabsLayout() {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;
    Promise.all([
      SecureStore.getItemAsync("hasSeenTour"),
      SecureStore.getItemAsync("pendingTour"),
    ]).then(([hasSeenTour, pendingTour]) => {
      if (pendingTour === "true" || !hasSeenTour) {
        setShowTour(true);
      }
    });
  }, []);

  const handleTourDone = async () => {
    if (Platform.OS === "web") {
      setShowTour(false);
      return;
    }
    await SecureStore.setItemAsync("hasSeenTour", "true");
    await SecureStore.deleteItemAsync("pendingTour");
    setShowTour(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "rgba(5,10,15,0.98)",
            borderTopColor: `${colors.primaryBright}28`,
            borderTopWidth: 1,
            height: 70,
            paddingTop: 7,
            paddingBottom: 7,
          },
          tabBarActiveTintColor: colors.primaryBright,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontSize: 9, fontWeight: "600", marginTop: 2 },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid-outline" size={21} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: "Scan",
            tabBarIcon: ({ color }) => (
              <Ionicons name="scan-outline" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="protect"
          options={{
            title: "Protection",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="shield-checkmark-outline" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => (
              <Ionicons name="settings-outline" size={21} color={color} />
            ),
          }}
        />
      </Tabs>

      <AppTour visible={showTour} onDone={handleTourDone} />
    </View>
  );
}
