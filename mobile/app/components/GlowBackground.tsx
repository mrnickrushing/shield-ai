import React from "react";
import { View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from "react-native-svg";

import { colors } from "@/theme/theme";

/**
 * Deep-space radial gradient mesh backdrop. Renders an indigo bloom that fades
 * into the void background, per the design deck. Place as the first child of a
 * screen with position absolute fill; content renders above it.
 */
export function GlowBackground({
  accent = colors.bgBloom,
  bloomOpacity = 1,
  centerY = 0.28,
}: {
  accent?: string;
  bloomOpacity?: number;
  centerY?: number;
}) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="bloom" cx="50%" cy={`${centerY * 100}%`} rx="75%" ry="45%">
            <Stop offset="0%" stopColor={accent} stopOpacity={bloomOpacity} />
            <Stop offset="55%" stopColor={accent} stopOpacity={bloomOpacity * 0.35} />
            <Stop offset="100%" stopColor={colors.bg} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="corner" cx="100%" cy="0%" rx="60%" ry="35%">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.14} />
            <Stop offset="100%" stopColor={colors.bg} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={colors.bg} />
        <Ellipse cx="50%" cy={`${centerY * 100}%`} rx="80%" ry="48%" fill="url(#bloom)" />
        <Ellipse cx="100%" cy="0%" rx="65%" ry="38%" fill="url(#corner)" />
      </Svg>
    </View>
  );
}
