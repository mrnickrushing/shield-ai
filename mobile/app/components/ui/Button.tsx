import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, Text, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { colors, gradients, motion, radius, spacing } from "@/theme/theme";

import { GradientLayer } from "./GradientLayer";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  label,
  onPress,
  icon,
  loading,
  disabled,
  variant = "primary",
  gradient,
  style,
  size = "md",
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  gradient?: readonly string[];
  style?: ViewStyle;
  size?: "md" | "sm";
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;

  const fillGradient =
    variant === "primary" ? gradient ?? gradients.primary : variant === "danger" ? gradients.danger : null;

  const textColor = variant === "secondary" || variant === "ghost" ? colors.text : "#06060f";
  const iconColor = variant === "secondary" || variant === "ghost" ? colors.primaryBright : "#06060f";

  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        onPressIn={() => {
          if (isDisabled) return;
          scale.value = withTiming(0.97, { duration: motion.fast });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: motion.fast });
        }}
        style={{
          borderRadius: radius.md,
          overflow: "hidden",
          opacity: isDisabled ? 0.5 : 1,
          borderWidth: variant === "secondary" || variant === "ghost" ? 1 : 0,
          borderColor: colors.borderHi,
          backgroundColor:
            variant === "secondary" ? colors.surface : variant === "ghost" ? "transparent" : undefined,
        }}
      >
        {fillGradient && <GradientLayer colors={fillGradient} />}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            paddingVertical: size === "sm" ? 10 : spacing.md,
            paddingHorizontal: spacing.lg,
          }}
        >
          {loading ? (
            <ActivityIndicator color={textColor} />
          ) : (
            <>
              {icon ? <Ionicons name={icon} size={18} color={iconColor} /> : null}
              <Text style={{ color: textColor, fontWeight: "800", fontSize: size === "sm" ? 13 : 15 }}>
                {label}
              </Text>
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}
