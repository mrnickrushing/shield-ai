import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import AppTour from "@/components/AppTour";
import { colors } from "@/theme/theme";

function ScanTabButton(props: any) {
  const focused = props.accessibilityState?.selected ?? false;
  return (
    <Pressable
      onPress={props.onPress}
      hitSlop={8}
      style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 6 }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: focused ? colors.primary : colors.surfaceAlt,
          borderWidth: 1.5,
          borderColor: colors.primaryBright + (focused ? "dd" : "55"),
          alignItems: "center",
          justifyContent: "center",
          marginTop: -22,
          shadowColor: colors.primaryBright,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: focused ? 0.7 : 0.3,
          shadowRadius: 18,
          elevation: 12,
        }}
      >
        <Ionicons
          name="scan"
          size={22}
          color={focused ? "#fff" : colors.primaryBright}
        />
      </View>
      <Text
        style={{
          color: focused ? colors.primaryBright : colors.textMuted,
          fontSize: 10,
          fontWeight: "700",
          marginTop: 4,
        }}
      >
        Scan
      </Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
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
            backgroundColor: "rgba(10,10,18,0.94)",
            borderTopColor: colors.borderHi,
            borderTopWidth: 1,
            height: 72,
            paddingBottom: 8,
            overflow: "visible",
          },
          tabBarActiveTintColor: colors.primaryBright,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: 2 },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="shield-checkmark-outline" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: "Scan",
            tabBarButton: (props) => <ScanTabButton {...props} />,
          }}
        />
        <Tabs.Screen
          name="protect"
          options={{
            title: "Protect",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="lock-closed-outline" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "History",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time-outline" size={22} color={color} />
            ),
          }}
        />
      </Tabs>

      <AppTour visible={showTour} onDone={handleTourDone} />
    </View>
  );
}
