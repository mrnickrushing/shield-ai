import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { colors } from "@/theme/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function ringColor(score: number) {
  if (score >= 90) return colors.safe;
  if (score >= 70) return colors.primaryBright;
  if (score >= 50) return colors.suspicious;
  return colors.critical;
}

function ringLabel(score: number) {
  if (score >= 90) return "EXCELLENT";
  if (score >= 70) return "PROTECTED";
  if (score >= 50) return "MODERATE";
  return "AT RISK";
}

export function ProtectionRing({ score, size = 148 }: { score: number; size?: number }) {
  const R = 54;
  const circ = 2 * Math.PI * R;
  const offset = useSharedValue(circ);

  useEffect(() => {
    offset.value = withTiming(circ * (1 - score / 100), {
      duration: 1600,
      easing: Easing.out(Easing.cubic),
    });
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  const color = ringColor(score);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2} cy={size / 2} r={R}
          fill="none" stroke={colors.border} strokeWidth={9}
        />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={R}
          fill="none"
          stroke={color}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={circ}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ alignItems: "center", gap: 2 }}>
        <Ionicons name="shield-checkmark" size={18} color={color} />
        <Text style={{ color: colors.text, fontSize: 38, fontWeight: "900", letterSpacing: -2, lineHeight: 44 }}>
          {score}
        </Text>
        <Text style={{ color, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 }}>
          {ringLabel(score)}
        </Text>
      </View>
    </View>
  );
}
