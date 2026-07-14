import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { colors, glow, gradients, spacing } from "@/theme/theme";

let gradientIdCounter = 0;

type GradientButtonProps = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  /** Gradient stops; defaults to the primary indigo run. */
  stops?: readonly string[];
  /** Glow color; defaults to the middle gradient stop. */
  glowColor?: string;
};

/**
 * Primary CTA per the design deck: indigo gradient fill, outer glow corona,
 * spring press scale. Destructive actions pass gradients.critical stops.
 */
export function GradientButton({
  label,
  onPress,
  icon,
  disabled,
  loading,
  stops = gradients.primary,
  glowColor,
}: GradientButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const corona = glowColor ?? stops[Math.floor(stops.length / 2)];
  const inactive = disabled || loading;
  const textColor = stops === gradients.primary ? colors.bg : "#fff";
  const [gradientId] = React.useState(() => `gbtn-${gradientIdCounter++}`);

  return (
    <Animated.View style={[animatedStyle, !inactive && glow(corona, "md")]}>
      <Pressable
        onPress={onPress}
        disabled={inactive}
        onPressIn={() => (scale.value = withSpring(0.96, { damping: 18 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 14 }))}
        style={{
          height: 48,
          borderRadius: 12,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          opacity: inactive ? 0.5 : 1,
        }}
      >
        <Svg width="100%" height="100%" style={{ position: "absolute" }}>
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              {stops.map((color, i) => (
                <Stop key={color + i} offset={`${(i / (stops.length - 1)) * 100}%`} stopColor={color} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            {icon ? <Ionicons name={icon} size={18} color={textColor} /> : null}
            <Text style={{ color: textColor, fontWeight: "800", fontSize: 15, letterSpacing: 0.2 }}>
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
