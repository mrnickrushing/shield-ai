import React, { useRef, useState } from "react";
import { LayoutChangeEvent, View, ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

let gradientId = 0;

/**
 * Fills its absolutely-positioned parent with a real multi-stop linear
 * gradient via SVG (no expo-linear-gradient native dep needed, so this
 * stays OTA-deployable). Use inside an `overflow: hidden` container.
 */
export function GradientLayer({
  colors,
  angle = 135,
  style,
}: {
  colors: readonly string[];
  angle?: number;
  style?: ViewStyle;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const id = useRef(`grad-${gradientId++}`).current;

  const rad = (angle * Math.PI) / 180;
  const x1 = 50 - 50 * Math.cos(rad);
  const y1 = 50 - 50 * Math.sin(rad);
  const x2 = 50 + 50 * Math.cos(rad);
  const y2 = 50 + 50 * Math.sin(rad);

  const onLayout = (e: LayoutChangeEvent) => setSize(e.nativeEvent.layout);

  return (
    <View
      style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, style]}
      onLayout={onLayout}
      pointerEvents="none"
    >
      {size.width > 0 && size.height > 0 && (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id={id} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}>
              {colors.map((c, i) => (
                <Stop key={i} offset={i / Math.max(1, colors.length - 1)} stopColor={c} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width={size.width} height={size.height} fill={`url(#${id})`} />
        </Svg>
      )}
    </View>
  );
}
