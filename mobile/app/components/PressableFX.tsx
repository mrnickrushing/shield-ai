import React, { useState } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

type PressableFXProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** Merged on top of `style` while the finger is down. */
  pressedStyle?: StyleProp<ViewStyle>;
};

/**
 * Pressable that never passes a function to `style`. The nativewind css-interop
 * JSX runtime (babel jsxImportSource) intercepts the style prop and drops
 * function-form styles on device, so pressed feedback must be tracked in state
 * and applied as a plain style array instead.
 */
export function PressableFX({ style, pressedStyle, onPressIn, onPressOut, ...rest }: PressableFXProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      {...rest}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      style={[style, pressed ? pressedStyle : null]}
    />
  );
}
