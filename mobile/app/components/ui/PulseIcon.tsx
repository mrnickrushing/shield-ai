import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

let glowId = 0;

/**
 * Icon glyph that pops and glows on press and, when `active`, breathes with
 * a continuous subtle pulse + glow (used for the currently-selected tab/icon).
 */
export function PulseIcon({
  name,
  size = 20,
  color = "#fff",
  pressed = false,
  active = false,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  pressed?: boolean;
  active?: boolean;
}) {
  const id = useRef(`pulse-glow-${glowId++}`).current;
  const press = useSharedValue(1);
  const pressGlow = useSharedValue(0);
  const idleScale = useSharedValue(1);
  const idleGlow = useSharedValue(0);

  useEffect(() => {
    press.value = withSpring(pressed ? 1.3 : 1, { damping: 9, stiffness: 220 });
    pressGlow.value = withTiming(pressed ? 1 : 0, { duration: pressed ? 120 : 250 });
  }, [pressed, press, pressGlow]);

  useEffect(() => {
    if (active) {
      idleScale.value = withRepeat(
        withSequence(withTiming(1.1, { duration: 700 }), withTiming(1, { duration: 700 })),
        -1,
        true
      );
      idleGlow.value = withRepeat(
        withSequence(withTiming(0.55, { duration: 700 }), withTiming(0.25, { duration: 700 })),
        -1,
        true
      );
    } else {
      idleScale.value = withTiming(1, { duration: 200 });
      idleGlow.value = withTiming(0, { duration: 200 });
    }
  }, [active, idleScale, idleGlow]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value * idleScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: Math.max(pressGlow.value, idleGlow.value),
  }));

  const glowSize = size * 2.6;

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        pointerEvents="none"
        style={[{ position: "absolute", width: glowSize, height: glowSize }, glowStyle]}
      >
        <Svg width={glowSize} height={glowSize}>
          <Defs>
            <RadialGradient id={id} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={color} stopOpacity={0.9} />
              <Stop offset="55%" stopColor={color} stopOpacity={0.35} />
              <Stop offset="100%" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={glowSize / 2} cy={glowSize / 2} r={glowSize / 2} fill={`url(#${id})`} />
        </Svg>
      </Animated.View>
      <Animated.View style={iconStyle}>
        <Ionicons name={name} size={size} color={color} />
      </Animated.View>
    </View>
  );
}
