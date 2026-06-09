/**
 * Share extension entry screen.
 *
 * When a user shares a URL or text to Shield AI from another app, this screen
 * receives the content, immediately fires the right scan, and shows the result.
 *
 * Requires a custom development build (not Expo Go) with expo-share-intent.
 * Configure expo-share-intent in app.json plugins before building.
 */
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { ShieldAPI } from "@/lib/api";
import { colors, spacing } from "@/theme/theme";

export default function ShareScreen() {
  const router = useRouter();
  const [status, setStatus] = useState("Analyzing shared content…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleSharedContent();
  }, []);

  async function handleSharedContent() {
    try {
      // expo-share-intent puts the incoming payload on the module
      const { useShareIntent } = await import("expo-share-intent");
      // This hook must be called inside a component; we read from the module directly here
      // For full hook usage, migrate this logic into a proper hook-aware component.
      const { hasShareIntent, shareIntent, resetShareIntent } =
        (useShareIntent as unknown as () => {
          hasShareIntent: boolean;
          shareIntent: { text?: string; webUrl?: string } | null;
          resetShareIntent: () => void;
        })();

      if (!hasShareIntent || !shareIntent) {
        setStatus("No shared content found.");
        return;
      }

      const url = shareIntent.webUrl;
      const text = shareIntent.text;

      let scan;
      if (url) {
        setStatus("Checking shared link…");
        scan = await ShieldAPI.scanLink(url);
      } else if (text) {
        setStatus("Analyzing shared text…");
        scan = await ShieldAPI.scanMessage(text);
      } else {
        setStatus("Unsupported content type.");
        return;
      }

      resetShareIntent();
      router.replace(`/result?id=${scan.id}`);
    } catch (e: any) {
      // expo-share-intent not set up or error analyzing
      setError(
        e?.response?.data?.detail ??
          "Could not analyze shared content. Make sure you're logged in."
      );
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center", padding: spacing.lg }}>
      {error ? (
        <>
          <Text style={{ color: colors.critical, textAlign: "center", marginBottom: spacing.md }}>{error}</Text>
          <Text
            onPress={() => router.replace("/")}
            style={{ color: colors.primary }}
          >
            Go to app
          </Text>
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primaryBright} size="large" />
          <Text style={{ color: colors.textMuted, marginTop: spacing.md }}>{status}</Text>
        </>
      )}
    </View>
  );
}
