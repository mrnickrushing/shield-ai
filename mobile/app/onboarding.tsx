import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, Text, View, ViewToken } from "react-native";

import { colors, radius, spacing } from "@/theme/theme";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    icon: "shield-checkmark" as const,
    iconColor: colors.primaryBright,
    title: "Stop scams before\nthey happen",
    body: "Shield AI analyzes anything suspicious — links, texts, emails, screenshots — and tells you exactly what to do.",
  },
  {
    id: "2",
    icon: "scan" as const,
    iconColor: colors.safe,
    title: "Scan anything in\nseconds",
    body: "Paste a URL, forward a text, upload a screenshot. Our AI gives you a risk score, red flags, and recommended actions instantly.",
  },
  {
    id: "3",
    icon: "people" as const,
    iconColor: colors.suspicious,
    title: "Protect yourself\nand your family",
    body: "Add trusted contacts, get guided scam recovery, and learn to spot fraud with bite-sized lessons.",
  },
  {
    id: "4",
    icon: "star" as const,
    iconColor: colors.low,
    title: "Full protection,\nunlimited scans",
    body: "Premium gives you unlimited scans, identity breach monitoring, priority AI analysis, and family alert sharing.",
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;

  const finish = async () => {
    await SecureStore.setItemAsync("hasSeenOnboarding", "true");
    router.replace("/login");
  };

  const next = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      finish();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Skip */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl, alignItems: "flex-end" }}>
        <Pressable onPress={finish}>
          <Text style={{ color: colors.textMuted, fontSize: 15 }}>Skip</Text>
        </Pressable>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <View style={{ width, flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}>
            <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: item.iconColor + "22", alignItems: "center", justifyContent: "center", marginBottom: spacing.xl, borderWidth: 2, borderColor: item.iconColor + "44" }}>
              <Ionicons name={item.icon} size={48} color={item.iconColor} />
            </View>
            <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -0.8, textAlign: "center", marginBottom: spacing.md, lineHeight: 38 }}>{item.title}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 16, textAlign: "center", lineHeight: 24 }}>{item.body}</Text>
          </View>
        )}
        style={{ flex: 1 }}
      />

      {/* Dots */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: spacing.lg }}>
        {SLIDES.map((_, i) => (
          <View key={i} style={{ width: i === activeIndex ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: i === activeIndex ? colors.primaryBright : colors.border }} />
        ))}
      </View>

      {/* CTA */}
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: 48 }}>
        <Pressable
          onPress={next}
          style={{ backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17, letterSpacing: -0.2 }}>
            {activeIndex < SLIDES.length - 1 ? "Continue" : "Get Started →"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
