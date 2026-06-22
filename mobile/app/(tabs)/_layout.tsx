import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { Tabs, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import AppTour from "@/components/AppTour";
import { PulseIcon } from "@/components/ui";
import { colors, spacing } from "@/theme/theme";

function ScanTabButton(props: any) {
  const focused = props.accessibilityState?.selected ?? false;
  return (
    <Pressable
      onPress={props.onPress}
      hitSlop={8}
      style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 6 }}
    >
      {({ pressed }: { pressed: boolean }) => (
        <>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: focused ? colors.primary : colors.surface,
              borderWidth: 1.5,
              borderColor: focused ? colors.primaryBright + "aa" : colors.borderHi,
              alignItems: "center",
              justifyContent: "center",
              marginTop: -22,
              shadowColor: colors.primaryBright,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: focused ? 0.55 : 0.15,
              shadowRadius: 14,
              elevation: 12,
            }}
          >
            <PulseIcon
              name="scan"
              size={22}
              color={focused ? "#fff" : colors.primaryBright}
              pressed={pressed}
              active={focused}
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
        </>
      )}
    </Pressable>
  );
}

function TabButton({
  icon,
  label,
  onPress,
  accessibilityState,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: (e: any) => void;
  accessibilityState?: { selected?: boolean };
}) {
  const focused = accessibilityState?.selected ?? false;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 2 }}
    >
      {({ pressed }: { pressed: boolean }) => (
        <>
          <PulseIcon
            name={icon}
            size={22}
            color={focused ? colors.primaryBright : colors.textMuted}
            pressed={pressed}
            active={focused}
          />
          <Text
            style={{
              color: focused ? colors.primaryBright : colors.textMuted,
              fontSize: 10,
              fontWeight: "700",
              marginTop: 2,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export default function TabsLayout() {
  const router = useRouter();
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
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 72,
            paddingBottom: 8,
            overflow: "visible",
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Home",
            tabBarButton: (props) => <TabButton icon="shield-checkmark-outline" label="Home" {...props} />,
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
            tabBarButton: (props) => <TabButton icon="lock-closed-outline" label="Protect" {...props} />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "History",
            tabBarButton: (props) => <TabButton icon="time-outline" label="History" {...props} />,
          }}
        />
      </Tabs>

      <AppTour visible={showTour} onDone={handleTourDone} />
    </View>
  );
}
