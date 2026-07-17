import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { colors, radius, spacing, withAlpha } from "@/theme/theme";

export function QueryErrorState({
  message = "We couldn't load this data. Check your connection and try again.",
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        alignItems: "center",
        borderColor: withAlpha(colors.suspicious, "66"),
        borderRadius: radius.md,
        borderWidth: 1,
        backgroundColor: withAlpha(colors.suspicious, "12"),
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={30} color={colors.suspicious} />
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800", textAlign: "center" }}>
        Data unavailable
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: "center" }}>
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry loading data"
        onPress={onRetry}
        style={{
          minHeight: 44,
          minWidth: 96,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.pill,
          backgroundColor: withAlpha(colors.primaryBright, "22"),
          paddingHorizontal: spacing.lg,
        }}
      >
        <Text style={{ color: colors.primaryBright, fontSize: 14, fontWeight: "800" }}>Try again</Text>
      </Pressable>
    </View>
  );
}
