import React from "react";
import { StyleSheet, Text as RNText } from "react-native";

/**
 * Global text scaling. Every <Text> in the app sets its own hardcoded
 * fontSize, so there's no single knob to make the whole app bigger. We patch
 * the Text component's render once to multiply whatever fontSize it resolves
 * to by a module-level scale — giving us both a larger baseline for everyone
 * and a working "Large Text" accessibility toggle.
 */

// Baseline is a very slight bump over the app's hand-tuned sizes — a flat
// multiplier inflates already-large headers too, so keep it gentle. Large Text
// mode is the opt-in accessibility boost.
export const BASE_FONT_SCALE = 1.05;
export const LARGE_FONT_SCALE = 1.3;
const DEFAULT_FONT_SIZE = 14; // RN's implicit default when a Text sets none

let currentScale = BASE_FONT_SCALE;

export function setLargeTextMode(enabled: boolean): void {
  currentScale = enabled ? LARGE_FONT_SCALE : BASE_FONT_SCALE;
}

export function installGlobalFontScaling(): void {
  const AnyText = RNText as unknown as {
    render?: (...args: any[]) => any;
    __shieldFontScalePatched?: boolean;
  };
  if (AnyText.__shieldFontScalePatched || typeof AnyText.render !== "function") return;

  const originalRender = AnyText.render;
  AnyText.render = function patchedRender(...args: any[]) {
    const element = originalRender.apply(this, args);
    if (!element || !element.props) return element;
    const flattened = StyleSheet.flatten(element.props.style) || {};
    const base = typeof flattened.fontSize === "number" ? flattened.fontSize : DEFAULT_FONT_SIZE;
    const override: { fontSize: number; lineHeight?: number } = {
      fontSize: Math.round(base * currentScale),
    };
    // Scale a fixed lineHeight alongside fontSize; otherwise enlarged text
    // clips or overlaps inside a line box sized for the original font.
    if (typeof flattened.lineHeight === "number") {
      override.lineHeight = Math.round(flattened.lineHeight * currentScale);
    }
    return React.cloneElement(element, {
      style: [element.props.style, override],
      // Our scale already enlarges text; cap OS Dynamic Type so the two don't
      // compound into unusably huge type.
      maxFontSizeMultiplier: element.props.maxFontSizeMultiplier ?? 1.3,
    });
  };
  AnyText.__shieldFontScalePatched = true;
}
