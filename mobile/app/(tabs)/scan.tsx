import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { ShieldAPI } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

export default function ScanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const [type, setType] = useState<"link" | "image">(params.type === "image" ? "image" : "link");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runLink = async () => {
    setError(null);
    setLoading(true);
    try {
      const scan = await ShieldAPI.scanLink(url.trim());
      router.push(`/result?id=${scan.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Scan failed.");
    } finally {
      setLoading(false);
    }
  };

  const runImage = async () => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
    if (res.canceled || !res.assets[0]?.base64) return;
    setLoading(true);
    try {
      const scan = await ShieldAPI.scanImage(res.assets[0].base64);
      router.push(`/result?id=${scan.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Scan failed.");
    } finally {
      setLoading(false);
    }
  };

  const Toggle = ({ value, label }: { value: "link" | "image"; label: string }) => (
    <Pressable
      onPress={() => setType(value)}
      style={{
        flex: 1,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: type === value ? colors.primary : colors.surface,
        alignItems: "center",
      }}
    >
      <Text style={{ color: type === value ? "#fff" : colors.textMuted, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
        <Toggle value="link" label="Link" />
        <Toggle value="image" label="Screenshot" />
      </View>

      {type === "link" ? (
        <>
          <TextInput
            placeholder="Paste a URL to check…"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="url"
            value={url}
            onChangeText={setUrl}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.md,
              color: colors.text,
              padding: spacing.md,
              marginBottom: spacing.md,
            }}
          />
          <Pressable
            onPress={runLink}
            disabled={loading || !url.trim()}
            style={{ backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.md, alignItems: "center" }}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Analyze Link</Text>}
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={runImage}
          disabled={loading}
          style={{ backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radius.md, alignItems: "center" }}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Choose Screenshot</Text>}
        </Pressable>
      )}

      {error && <Text style={{ color: colors.critical, marginTop: spacing.md }}>{error}</Text>}
    </ScrollView>
  );
}
