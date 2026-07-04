import React from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, glow, radius } from "@/theme/theme";

type GlassCardProps = {
  children: React.ReactNode;
  /** Accent color; renders a glowing top-edge line and outer glow when set. */
  accent?: string;
  /** Elevated cards emit an outer glow in their accent color. */
  elevated?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Glassmorphism card per the design deck: translucent surface, hairline
 * border, optional accent top-edge glow line. Pressable when onPress is set.
 */
export function GlassCard({ children, accent, elevated, onPress, style }: GlassCardProps) {
  const base: ViewStyle = {
    backgroundColor: colors.glassDeep,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: accent ? `${accent}40` : colors.borderHi,
    overflow: "hidden",
    ...(elevated && accent ? glow(accent, "sm") : null),
  };

  const inner = (
    <>
      {accent ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: radius.lg,
            right: radius.lg,
            height: 2,
            borderRadius: 1,
            backgroundColor: accent,
            opacity: 0.8,
            ...glow(accent, "sm"),
          }}
        />
      ) : null}
      {children}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          base,
          pressed && { backgroundColor: colors.glassActive, transform: [{ scale: 0.97 }] },
          style,
        ]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{inner}</View>;
}
