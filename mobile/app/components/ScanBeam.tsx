import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { colors, gradients } from "@/theme/theme";

let beamIdCounter = 0;

/**
 * Horizontal gradient beam that sweeps top-to-bottom over scanned content
 * during analysis (~1.2s per pass), per the design deck. Parent must have a
 * fixed height and overflow hidden.
 */
export function ScanBeam({ height }: { height: number }) {
  const progress = useSharedValue(0);
  const [gradientId] = React.useState(() => `beam-${beamIdCounter++}`);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * height }],
    opacity: 0.9,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", top: -3, left: 0, right: 0, height: 3 }, style]}
    >
      <Svg width="100%" height="3">
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={gradients.scanBeam[0]} stopOpacity={0} />
            <Stop offset="35%" stopColor={gradients.scanBeam[0]} stopOpacity={1} />
            <Stop offset="65%" stopColor={gradients.scanBeam[1]} stopOpacity={1} />
            <Stop offset="100%" stopColor={gradients.scanBeam[1]} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="3" fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Four animated corner brackets that slide inward when mounted — frames a
 * camera viewfinder or scan target area.
 */
export function CornerBrackets({ color = colors.primaryBright, inset = 14 }: { color?: string; inset?: number }) {
  const slide = useSharedValue(12);

  useEffect(() => {
    slide.value = withTiming(0, { duration: 450, easing: Easing.out(Easing.back(1.6)) });
  }, [slide]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + slide.value / 100 }],
    opacity: 1 - slide.value / 30,
  }));

  const arm = 18;
  const thickness = 2.5;
  const corners = [
    { top: inset, left: inset, borderTopWidth: thickness, borderLeftWidth: thickness },
    { top: inset, right: inset, borderTopWidth: thickness, borderRightWidth: thickness },
    { bottom: inset, left: inset, borderBottomWidth: thickness, borderLeftWidth: thickness },
    { bottom: inset, right: inset, borderBottomWidth: thickness, borderRightWidth: thickness },
  ] as const;

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, style]}
    >
      {corners.map((corner, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: arm,
            height: arm,
            borderColor: color,
            borderRadius: 2,
            ...corner,
          }}
        />
      ))}
    </Animated.View>
  );
}
