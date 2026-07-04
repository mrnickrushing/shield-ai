import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from "react-native-svg";

import { GradientText } from "@/components/GradientText";
import { colors, glow, gradients } from "@/theme/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

let ringIdCounter = 0;

function ringColor(score: number) {
  if (score >= 90) return colors.safe;
  if (score >= 70) return colors.primaryBright;
  if (score >= 50) return colors.suspicious;
  return colors.critical;
}

function ringLabel(score: number) {
  if (score >= 90) return "ALL SYSTEMS PROTECTED";
  if (score >= 70) return "PROTECTED";
  if (score >= 50) return "MODERATE RISK";
  return "AT RISK";
}

export function ProtectionRing({ score, size = 220 }: { score: number; size?: number }) {
  const strokeWidth = size * 0.052;
  const R = size / 2 - strokeWidth - size * 0.06;
  const circ = 2 * Math.PI * R;
  const offset = useSharedValue(circ);
  const breathe = useSharedValue(1);
  const [ids] = React.useState(() => {
    const n = ringIdCounter++;
    return { arc: `ring-arc-${n}`, halo: `ring-halo-${n}` };
  });

  useEffect(() => {
    offset.value = withTiming(circ * (1 - score / 100), {
      duration: 1600,
      easing: Easing.out(Easing.cubic),
    });
  }, [score, circ, offset]);

  useEffect(() => {
    // Ambient breathe per the design deck: 1.0 -> 1.04 over 3s, looped.
    breathe.value = withRepeat(
      withTiming(1.04, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [breathe]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  const breatheStyle = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }] }));
  const color = ringColor(score);
  const haloOpacity = 0.25 + (score / 100) * 0.45;

  return (
    <View style={{ alignItems: "center" }}>
      <Animated.View
        style={[
          { width: size, height: size, alignItems: "center", justifyContent: "center" },
          breatheStyle,
          glow(color, "lg"),
        ]}
      >
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Defs>
            <LinearGradient id={ids.arc} x1="0%" y1="100%" x2="100%" y2="0%">
              {gradients.ring.map((stop, i) => (
                <Stop
                  key={stop + i}
                  offset={`${(i / (gradients.ring.length - 1)) * 100}%`}
                  stopColor={stop}
                />
              ))}
            </LinearGradient>
            <RadialGradient id={ids.halo} cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="55%" stopColor={color} stopOpacity={0} />
              <Stop offset="82%" stopColor={color} stopOpacity={haloOpacity * 0.4} />
              <Stop offset="100%" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {/* Ambient halo behind the ring */}
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${ids.halo})`} />
          <Circle
            cx={size / 2} cy={size / 2} r={R}
            fill="none" stroke={colors.border} strokeWidth={strokeWidth}
          />
          <AnimatedCircle
            cx={size / 2} cy={size / 2} r={R}
            fill="none"
            stroke={`url(#${ids.arc})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circ}
            animatedProps={animatedProps}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={{ alignItems: "center" }}>
          <Ionicons name="shield-checkmark" size={size * 0.1} color={color} />
          <GradientText
            text={String(score)}
            fontSize={size * 0.3}
            width={size * 0.62}
            height={size * 0.36}
            letterSpacing={-2}
          />
        </View>
      </Animated.View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: -6 }}>
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: color,
            ...glow(color, "sm"),
          }}
        />
        <Text style={{ color, fontSize: 11, fontWeight: "800", letterSpacing: 1.4 }}>
          {ringLabel(score)}
        </Text>
      </View>
    </View>
  );
}
