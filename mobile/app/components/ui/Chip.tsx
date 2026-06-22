import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text } from "react-native";

import { colors, radius, spacing, withAlpha } from "@/theme/theme";

export function Chip({
  label,
  active,
  color = colors.primaryBright,
  icon,
  onPress,
  size = "md",
}: {
  label: string;
  active: boolean;
  color?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: "md" | "sm";
}) {
  const sm = size === "sm";
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: sm ? spacing.sm : spacing.md,
        paddingVertical: sm ? 6 : 8,
        borderRadius: radius.pill,
        backgroundColor: active ? withAlpha(color, "22") : colors.surface,
        borderWidth: 1,
        borderColor: active ? color : colors.border,
      }}
    >
      {icon ? <Ionicons name={icon} size={sm ? 12 : 14} color={active ? color : colors.textMuted} /> : null}
      <Text style={{ color: active ? color : colors.textMuted, fontWeight: "700", fontSize: sm ? 11 : 12 }}>
        {label}
      </Text>
    </Pressable>
  );
}
