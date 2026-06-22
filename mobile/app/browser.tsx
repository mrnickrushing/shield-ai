import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { Button, Eyebrow, FadeIn, Surface } from "@/components/ui";
import { ShieldAPI, Scan } from "@/lib/api";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";

const RISK_COLORS: Record<string, string> = {
  safe: colors.safe,
  low: colors.low,
  suspicious: colors.suspicious,
  high: colors.high,
  critical: colors.critical,
};

export default function BrowserScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string }>();
  const insets = useSafeAreaInsets();
  const [inputUrl, setInputUrl] = useState("");
  const [scanResult, setScanResult] = useState<Scan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!params.url) return;
    const decoded = decodeURIComponent(params.url);
    setInputUrl(decoded);
  }, [params.url]);

  const handleScan = async () => {
    const raw = inputUrl.trim();
    if (!raw) return;
    const url = raw.startsWith("http") ? raw : `https://${raw}`;
    setError(null);
    setScanResult(null);
    setConfirmed(false);
    setCurrentUrl(null);
    setScanning(true);
    try {
      const result = await ShieldAPI.scanLink(url);
      setScanResult(result);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Scan failed. Check your connection.");
    } finally {
      setScanning(false);
    }
  };

  const proceed = () => {
    const raw = inputUrl.trim();
    const url = raw.startsWith("http") ? raw : `https://${raw}`;
    setCurrentUrl(url);
    setConfirmed(true);
  };

  const riskLevel = scanResult?.report?.risk_level;
  const riskScore = scanResult?.report?.risk_score ?? 0;
  const isSafe = riskLevel === "safe" || riskLevel === "low";
  const isDangerous = riskLevel === "high" || riskLevel === "critical";
  const riskColor = RISK_COLORS[riskLevel ?? "safe"];

  const domainLabel = (() => {
    if (!inputUrl.trim()) return null;
    try {
      const url = inputUrl.trim().startsWith("http")
        ? inputUrl.trim()
        : `https://${inputUrl.trim()}`;
      return new URL(url).hostname;
    } catch {
      return null;
    }
  })();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.md,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          gap: spacing.sm,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.primaryBright, fontSize: 14 }}>← Back</Text>
        </Pressable>

        {/* URL bar */}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <TextInput
            placeholder="Enter a URL to scan…"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={handleScan}
            value={inputUrl}
            onChangeText={(t) => {
              setInputUrl(t);
              setScanResult(null);
              setConfirmed(false);
              setCurrentUrl(null);
            }}
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.md,
              color: colors.text,
              padding: spacing.sm,
              fontSize: 14,
            }}
          />
          <Button
            label="Scan"
            onPress={handleScan}
            disabled={!inputUrl.trim()}
            loading={scanning}
            size="sm"
            style={{ alignSelf: "stretch", justifyContent: "center" }}
          />
        </View>

        {/* Domain clarity bar */}
        {domainLabel && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            {scanResult && (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: riskColor,
                }}
              />
            )}
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{domainLabel}</Text>
            {scanResult && riskScore > 0 && (
              <Text style={{ color: riskColor, fontSize: 12, fontWeight: "700" }}>
                · Risk {riskScore}/100
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Error */}
      {error && (
        <View style={{ padding: spacing.md }}>
          <Text style={{ color: colors.critical, textAlign: "center" }}>{error}</Text>
        </View>
      )}

      {/* Scan result warning overlay */}
      {scanResult && !confirmed && (
        <View style={{ padding: spacing.lg }}>
          <FadeIn>
            <Surface
              accent={isDangerous ? colors.critical : undefined}
              style={isDangerous ? { borderWidth: 2 } : undefined}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: withAlpha(riskColor, "22"),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={isDangerous ? "warning-outline" : isSafe ? "checkmark-circle-outline" : "alert-circle-outline"}
                    size={22}
                    color={riskColor}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>
                    {isDangerous ? "Warning: High Risk" : isSafe ? "Looks Safe" : "Proceed with Caution"}
                  </Text>
                  <Text style={{ color: riskColor, fontWeight: "700" }}>
                    {riskLevel?.toUpperCase()} · Score {riskScore}/100
                  </Text>
                </View>
              </View>

              {scanResult.report?.explanation && (
                <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm }}>
                  {scanResult.report.explanation}
                </Text>
              )}

              {scanResult.report?.red_flags && scanResult.report.red_flags.length > 0 && (
                <>
                  <Eyebrow style={{ marginBottom: spacing.xs }}>Red Flags</Eyebrow>
                  {scanResult.report.red_flags.map((flag, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: spacing.xs, marginBottom: 4 }}>
                      <Text style={{ color: colors.critical, fontSize: 13 }}>•</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 13, flex: 1 }}>{flag}</Text>
                    </View>
                  ))}
                </>
              )}

              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                <Button
                  label="Go Back"
                  variant="secondary"
                  onPress={() => {
                    setScanResult(null);
                    setInputUrl("");
                  }}
                  style={{ flex: 1 }}
                />
                {!isDangerous && (
                  <Button
                    label={isSafe ? "Open Safely" : "Open Anyway"}
                    onPress={proceed}
                    gradient={isSafe ? undefined : [colors.suspicious, colors.high]}
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            </Surface>
          </FadeIn>
        </View>
      )}

      {/* WebView */}
      {confirmed && currentUrl && (
        <WebView
          source={{ uri: currentUrl }}
          style={{ flex: 1 }}
          startInLoadingState
          renderLoading={() => (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
              <ActivityIndicator color={colors.primaryBright} size="large" />
            </View>
          )}
        />
      )}

      {/* Empty state */}
      {!scanResult && !scanning && !confirmed && !error && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: withAlpha(colors.teal, "18"),
              alignItems: "center",
              justifyContent: "center",
              marginBottom: spacing.md,
            }}
          >
            <Ionicons name="globe-outline" size={32} color={colors.teal} />
          </View>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: spacing.sm, textAlign: "center" }}>
            Safe Browser
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: "center" }}>
            Every link is analyzed before your browser opens it.
            Enter a URL above and tap Scan.
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
