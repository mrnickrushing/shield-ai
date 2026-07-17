import React from "react";
import { Text, type TextStyle } from "react-native";

import { colors } from "@/theme/theme";

/**
 * The "Shield AI" wordmark: a bright cyan "Shield", white "AI", and a neon glow
 * that scales with the font size. Used in every screen header so the brand reads
 * loud and consistent instead of fading into the chrome.
 */
export function BrandWordmark({
  size = 24,
  style,
  children,
}: {
  size?: number;
  style?: TextStyle;
  /** Optional suffix rendered after "AI" (e.g. " Multi-Scanner"), same glow. */
  children?: React.ReactNode;
}) {
  return (
    <Text
      numberOfLines={1}
      style={{
        fontSize: size,
        fontWeight: "900",
        letterSpacing: 0.4,
        color: colors.text,
        textShadowColor: colors.primaryBright,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: size * 0.55,
        ...style,
      }}
    >
      <Text style={{ color: colors.primaryBright }}>Shield</Text> AI{children}
    </Text>
  );
}
