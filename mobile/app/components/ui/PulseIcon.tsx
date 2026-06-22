import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

/**
 * Icon glyph that pops on press and, when `active`, breathes with a
 * continuous subtle pulse (used for the currently-selected tab/icon).
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
  const press = useSharedValue(1);
  const idle = useSharedValue(1);

  useEffect(() => {
    press.value = withSpring(pressed ? 1.3 : 1, { damping: 9, stiffness: 220 });
  }, [pressed, press]);

  useEffect(() => {
    if (active) {
      idle.value = withRepeat(
        withSequence(withTiming(1.1, { duration: 700 }), withTiming(1, { duration: 700 })),
        -1,
        true
      );
    } else {
      idle.value = withTiming(1, { duration: 200 });
    }
  }, [active, idle]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: press.value * idle.value }],
  }));

  return (
    <Animated.View style={style}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}
