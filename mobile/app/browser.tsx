import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

import { ShieldAPI, Scan } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

const RISK_COLORS: Record<string, string> = {
  safe: colors.safe ?? "#22c55e",
  low: "#facc15",
  suspicious: "#f97316",
  high: "#ef4444",
  critical: "#dc2626",
};

export default function BrowserScreen() {
  const router = useRouter();
  const [inputUrl, setInputUrl] = useState("");
  const [scanResult, setScanResult] = useState<Scan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

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
      <View style={{
        padding: spacing.md,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        gap: spacing.sm,
      }}>
        <Pressable onPress={() => router.back()}>
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
          <Pressable
            onPress={handleScan}
            disabled={scanning || !inputUrl.trim()}
            style={{
              backgroundColor: inputUrl.trim() ? colors.primary : colors.surface,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              justifyContent: "center",
            }}
          >
            {scanning ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700" }}>Scan</Text>
            )}
          </Pressable>
        </View>

        {/* Domain clarity bar */}
        {domainLabel && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            {scanResult && (
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: RISK_COLORS[riskLevel ?? "safe"],
              }} />
            )}
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{domainLabel}</Text>
            {scanResult && riskScore > 0 && (
              <Text style={{ color: RISK_COLORS[riskLevel ?? "safe"], fontSize: 12, fontWeight: "700" }}>
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
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderColor: isDangerous ? colors.critical ?? "#ef4444" : colors.border,
            borderWidth: isDangerous ? 2 : 1,
            padding: spacing.lg,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
              <Text style={{ fontSize: 28 }}>{isDangerous ? "⚠️" : isSafe ? "✅" : "🔶"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>
                  {isDangerous ? "Warning: High Risk" : isSafe ? "Looks Safe" : "Proceed with Caution"}
                </Text>
                <Text style={{ color: RISK_COLORS[riskLevel ?? "safe"], fontWeight: "700" }}>
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
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: spacing.xs }}>
                  RED FLAGS
                </Text>
                {scanResult.report.red_flags.map((flag, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: spacing.xs, marginBottom: 4 }}>
                    <Text style={{ color: colors.critical ?? "#ef4444", fontSize: 13 }}>•</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 13, flex: 1 }}>{flag}</Text>
                  </View>
                ))}
              </>
            )}

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <Pressable
                onPress={() => { setScanResult(null); setInputUrl(""); }}
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>Go Back</Text>
              </Pressable>
              {!isDangerous && (
                <Pressable
                  onPress={proceed}
                  style={{
                    flex: 1,
                    backgroundColor: isSafe ? colors.primary : "#f97316",
                    borderRadius: radius.md,
                    padding: spacing.md,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>
                    {isSafe ? "Open Safely" : "Open Anyway"}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
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
          <Text style={{ fontSize: 40, marginBottom: spacing.md }}>🌐</Text>
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
