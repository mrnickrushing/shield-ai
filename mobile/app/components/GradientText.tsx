import React from "react";
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";

import { gradients } from "@/theme/theme";

let gradientIdCounter = 0;

/**
 * Hero text rendered with a gradient fill via SVG, per the design deck
 * ("carved in light"). Sized for large numerals; width/height must bound the
 * rendered glyphs.
 */
export function GradientText({
  text,
  fontSize,
  width,
  height,
  stops = gradients.score,
  fontWeight = "900",
  letterSpacing = -1,
}: {
  text: string;
  fontSize: number;
  width: number;
  height: number;
  stops?: readonly string[];
  fontWeight?: string;
  letterSpacing?: number;
}) {
  const [gradientId] = React.useState(() => `gtxt-${gradientIdCounter++}`);
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          {stops.map((color, i) => (
            <Stop key={color + i} offset={`${(i / (stops.length - 1)) * 100}%`} stopColor={color} />
          ))}
        </LinearGradient>
      </Defs>
      <SvgText
        x={width / 2}
        y={height / 2}
        fill={`url(#${gradientId})`}
        fontSize={fontSize}
        fontWeight={fontWeight}
        letterSpacing={letterSpacing}
        textAnchor="middle"
        alignmentBaseline="central"
      >
        {text}
      </SvgText>
    </Svg>
  );
}
