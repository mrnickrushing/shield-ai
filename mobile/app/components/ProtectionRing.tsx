import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

import { colors } from "@/theme/theme";

import { GlowOrb } from "./ui/GlowOrb";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function ringColors(score: number): readonly [string, string] {
  if (score >= 90) return [colors.teal, colors.safe];
  if (score >= 70) return [colors.accent, colors.primaryBright];
  if (score >= 50) return [colors.suspicious, colors.high];
  return [colors.high, colors.critical];
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
  const [from, to] = ringColors(score);

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <GlowOrb color={to} size={size * 1.5} opacity={0.4} style={{ top: -size * 0.25, left: -size * 0.25 }} />
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Defs>
            <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={from} />
              <Stop offset="100%" stopColor={to} />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={colors.border} strokeWidth={9} />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={R}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={circ}
            animatedProps={animatedProps}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={{ alignItems: "center", gap: 2 }}>
          <Ionicons name="shield-checkmark" size={18} color={to} />
          <Text style={{ color: colors.text, fontSize: 38, fontWeight: "900", letterSpacing: -2, lineHeight: 44 }}>
            {score}
          </Text>
        </View>
      </View>
      <Text style={{ color: to, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginTop: -8 }}>
        {ringLabel(score)}
      </Text>
    </View>
  );
}
