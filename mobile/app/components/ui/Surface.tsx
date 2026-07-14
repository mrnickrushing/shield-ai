import React from "react";
import { View, ViewStyle } from "react-native";

import { PressableFX } from "@/components/PressableFX";
import { colors, radius, withAlpha } from "@/theme/theme";

export function Surface({
  children,
  style,
  accent,
  padded = true,
  onPress,
  glow,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Tint the border with this color instead of the neutral default. */
  accent?: string;
  padded?: boolean;
  onPress?: () => void;
  /** Adds a soft colored drop shadow, for cards that should feel "lit". */
  glow?: string;
}) {
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: accent ? withAlpha(accent, "33") : colors.border,
    padding: padded ? 18 : 0,
    overflow: "hidden",
    ...(glow
      ? {
          shadowColor: glow,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 8,
        }
      : null),
  };

  if (!onPress) {
    return <View style={[base, style]}>{children}</View>;
  }

  return (
    <PressableFX
      onPress={onPress}
      style={[base, style]}
      pressedStyle={{ backgroundColor: colors.surfaceActive }}
    >
      {children}
    </PressableFX>
  );
}
