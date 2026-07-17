import React, { useEffect, useRef, useState } from "react";
import { Text, TextStyle } from "react-native";

import { motion } from "@/theme/theme";

/** Counts up to `value` whenever it changes. No native deps — plain rAF easing. */
export function AnimatedNumber({
  value,
  duration = motion.lazy,
  style,
}: {
  value: number;
  duration?: number;
  style?: TextStyle;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf: ReturnType<typeof requestAnimationFrame>;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <Text style={style}>{display}</Text>;
}
