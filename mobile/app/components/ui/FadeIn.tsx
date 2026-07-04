import React from "react";
import { ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { motion } from "@/theme/theme";

/** Staggered entrance wrapper so screens feel alive without per-screen animation code. */
export function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.slow).delay(delay).springify().damping(18).mass(0.7)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
