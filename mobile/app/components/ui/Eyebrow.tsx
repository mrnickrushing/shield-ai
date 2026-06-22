import React from "react";
import { Text, TextStyle } from "react-native";

import { colors, type } from "@/theme/theme";

export function Eyebrow({
  children,
  color = colors.textDim,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  style?: TextStyle;
}) {
  return <Text style={[type.eyebrow, { color }, style]}>{children}</Text>;
}
