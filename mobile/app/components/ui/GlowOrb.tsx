import React, { useState } from "react";
import { ViewStyle } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

let glowId = 0;

/**
 * Soft ambient light blob (radial gradient fading to transparent).
 * Used as decorative depth behind hero cards instead of the old
 * flat-opacity circles, which had a hard visible edge.
 */
export function GlowOrb({
  color,
  size = 200,
  opacity = 0.55,
  style,
}: {
  color: string;
  size?: number;
  opacity?: number;
  style?: ViewStyle;
}) {
  const [id] = useState(() => `glow-${glowId++}`);

  return (
    <Svg width={size} height={size} style={[{ position: "absolute" }, style] as any} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop offset="60%" stopColor={color} stopOpacity={opacity * 0.35} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}
