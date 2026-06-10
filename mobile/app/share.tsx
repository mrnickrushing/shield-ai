/**
 * Share extension entry screen.
 *
 * When a user shares a URL or text to Shield AI from another app, this screen
 * receives the content, immediately fires the right scan, and shows the result.
 *
 * Requires a custom development build (not Expo Go) with expo-share-intent.
 * Configure expo-share-intent in app.json plugins before building.
 */
import * as FileSystem from "expo-file-system";
import { useShareIntent } from "expo-share-intent";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { ShieldAPI } from "@/lib/api";
import { colors, spacing } from "@/theme/theme";

type SharedFile = {
  fileName: string;
  mimeType: string;
  path: string;
};

type SharedIntentPayload = {
  files?: SharedFile[] | null;
  text?: string | null;
  webUrl?: string | null;
};

async function scanSharedImage(file: SharedFile) {
  const fileUri = file.path;
  const imageBase64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return ShieldAPI.scanImage(imageBase64, file.fileName || "shared-image.jpg");
}

export default function ShareScreen() {
  const router = useRouter();
  // Hook must be called unconditionally at the component top level.
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const [status, setStatus] = useState("Analyzing shared content…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasShareIntent || !shareIntent) return;

    const payload = shareIntent as SharedIntentPayload;
    const url = payload.webUrl?.trim();
    const text = payload.text?.trim();
    const sharedImage = payload.files?.find((file) => file.mimeType?.startsWith("image/") && file.path);

    (async () => {
      try {
        let scan;
        if (url) {
          setStatus("Checking shared link…");
          scan = await ShieldAPI.scanLink(url);
        } else if (sharedImage) {
          setStatus("Scanning shared image…");
          scan = await scanSharedImage(sharedImage);
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
        setError(
          e?.response?.data?.detail ??
            "Could not analyze shared content. Make sure you're logged in."
        );
      }
    })();
  }, [hasShareIntent, resetShareIntent, router, shareIntent]); // re-runs when share intent arrives

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
