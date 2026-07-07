import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

import { Button, FadeIn, Surface } from "@/components/ui";
import { ShieldAPI, UrlVerdict } from "@/lib/api";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";

const RISK_COLORS: Record<string, string> = {
  safe: colors.safe,
  low: colors.low,
  suspicious: colors.suspicious,
  high: colors.high,
  critical: colors.critical,
  unverified: colors.textMuted,
};

const DANGEROUS = new Set(["high", "critical"]);

function normalize(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// "google.com" vs "www.google.com" should count as the same site so a plain
// canonicalization redirect doesn't get treated as an unverified navigation.
function baseDomain(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

type PageState = {
  url: string;
  verdict: UrlVerdict["verdict"] | "unverified";
  reason: string;
};

export default function BrowserScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string }>();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);

  const [inputUrl, setInputUrl] = useState("");
  const [page, setPage] = useState<PageState | null>(null); // what the WebView is showing
  const [checking, setChecking] = useState(false);
  const [blocked, setBlocked] = useState<UrlVerdict | null>(null); // interstitial
  const [canGoBack, setCanGoBack] = useState(false);

  // Every verdict this session, so in-page clicks resolve instantly on revisit.
  const verdictCache = useRef(new Map<string, UrlVerdict>());
  // High-risk URLs the user explicitly chose to open anyway.
  const overrides = useRef(new Set<string>());

  const getVerdict = useCallback(async (url: string): Promise<UrlVerdict | null> => {
    const hit = verdictCache.current.get(url);
    if (hit) return hit;
    try {
      const verdict = await ShieldAPI.checkUrl(url);
      verdictCache.current.set(url, verdict);
      return verdict;
    } catch {
      return null; // offline / timeout -> fail open as "unverified"
    }
  }, []);

  const recordTelemetry = useCallback((url: string, verdict: string, action: "viewed" | "blocked" | "allowed" | "trusted" | "override", reason = "") => {
    ShieldAPI.recordBrowserEvent({ url, domain: hostOf(url), verdict, action, reason }).catch(() => {});
  }, []);

  const navigateTo = useCallback(
    async (rawUrl: string) => {
      const url = normalize(rawUrl);
      if (!url) return;
      setBlocked(null);
      setChecking(true);
      setInputUrl(url);
      const verdict = await getVerdict(url);
      setChecking(false);

      if (verdict && DANGEROUS.has(verdict.verdict) && !overrides.current.has(url)) {
        setBlocked(verdict);
        recordTelemetry(url, verdict.verdict, "blocked", verdict.reason);
        return;
      }
      setPage({
        url,
        verdict: verdict?.verdict ?? "unverified",
        reason: verdict?.reason ?? "Couldn't verify this site right now.",
      });
      recordTelemetry(url, verdict?.verdict ?? "unverified", verdict ? "allowed" : "viewed", verdict?.reason ?? "");
    },
    [getVerdict, recordTelemetry]
  );

  useEffect(() => {
    if (params.url) navigateTo(decodeURIComponent(params.url));
    // Only respond to the incoming deep-link param.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.url]);

  /** Gatekeeper for every navigation started inside the WebView. */
  const onShouldStartLoadWithRequest = useCallback(
    (request: any): boolean => {
      const { url } = request;
      if (!/^https?:\/\//i.test(url)) return false; // block custom schemes
      if (Platform.OS === "ios" && request.isTopFrame === false) return true; // subresources/iframes load freely
      if (page && url === page.url) return true; // the load we already approved

      const known = verdictCache.current.get(url);
      if (known && !DANGEROUS.has(known.verdict)) {
        // Approved before — let it through and update the badge.
        setPage({ url, verdict: known.verdict, reason: known.reason });
        setInputUrl(url);
        return true;
      }
      if (overrides.current.has(url)) return true;

      // Same-site redirect (e.g. bare domain → www, or http → https
      // canonicalization) — the destination is already covered by the
      // check we just ran, so let it through instead of cancelling the
      // in-flight navigation and forcing a fresh reload.
      if (page && baseDomain(hostOf(url)) === baseDomain(hostOf(page.url))) {
        setPage({ url, verdict: page.verdict, reason: page.reason });
        setInputUrl(url);
        return true;
      }

      // Unknown or dangerous: hold the navigation, check it, then decide.
      navigateTo(url);
      return false;
    },
    [page, navigateTo]
  );

  const overrideAndOpen = () => {
    if (!blocked) return;
    overrides.current.add(normalize(blocked.url));
    recordTelemetry(blocked.url, blocked.verdict, "override", blocked.reason);
    navigateTo(blocked.url);
  };

  const badgeColor = RISK_COLORS[page?.verdict ?? "unverified"];
  const showCautionBanner = page?.verdict === "suspicious" || page?.verdict === "unverified";

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
          paddingBottom: spacing.sm,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: colors.primaryBright, fontSize: 14 }}>← Exit</Text>
          </Pressable>
          <Pressable
            onPress={() => canGoBack && webRef.current?.goBack()}
            hitSlop={12}
            disabled={!canGoBack}
          >
            <Ionicons name="chevron-back" size={20} color={canGoBack ? colors.text : colors.border} />
          </Pressable>
          <Pressable onPress={() => webRef.current?.reload()} hitSlop={12} disabled={!page}>
            <Ionicons name="refresh" size={18} color={page ? colors.text : colors.border} />
          </Pressable>

          {/* URL bar with live shield badge */}
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surface,
              borderColor: page ? withAlpha(badgeColor, "66") : colors.border,
              borderWidth: 1,
              borderRadius: radius.md,
              paddingHorizontal: spacing.sm,
            }}
          >
            <Ionicons
              name={page && DANGEROUS.has(page.verdict) ? "shield-outline" : "shield-checkmark"}
              size={16}
              color={page ? badgeColor : colors.textMuted}
              style={{ marginRight: 6 }}
            />
            <TextInput
              placeholder="Search or enter address"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={() => navigateTo(inputUrl)}
              value={inputUrl}
              onChangeText={setInputUrl}
              selectTextOnFocus
              style={{ flex: 1, color: colors.text, paddingVertical: spacing.sm, fontSize: 14 }}
            />
            {checking && <ActivityIndicator size="small" color={colors.primaryBright} />}
          </View>
        </View>

        {/* Live status line */}
        {page && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: badgeColor }} />
            <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
              {hostOf(page.url)} · {page.verdict === "unverified" ? "not verified" : `${page.verdict} · protected live`}
            </Text>
          </View>
        )}
      </View>

      {/* Caution banner for suspicious / unverified pages */}
      {page && showCautionBanner && (
        <View
          style={{
            backgroundColor: withAlpha(RISK_COLORS[page.verdict], "22"),
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
          }}
        >
          <Text style={{ color: RISK_COLORS[page.verdict], fontSize: 12 }} numberOfLines={2}>
            {page.verdict === "suspicious" ? "⚠ Be careful on this site: " : "◌ "}
            {page.reason} Never enter passwords or payment details you are not sure about.
          </Text>
        </View>
      )}

      {/* Danger interstitial */}
      {blocked && (
        <View style={{ padding: spacing.lg }}>
          <FadeIn>
            <Surface accent={colors.critical} style={{ borderWidth: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: withAlpha(RISK_COLORS[blocked.verdict], "22"),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="warning-outline" size={22} color={RISK_COLORS[blocked.verdict]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>
                    Shield AI blocked this site
                  </Text>
                  <Text style={{ color: RISK_COLORS[blocked.verdict], fontWeight: "700" }}>
                    {blocked.verdict.toUpperCase()} RISK · {blocked.domain}
                  </Text>
                </View>
              </View>

              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.md, lineHeight: 19 }}>
                {blocked.reason}
              </Text>

              <View style={{ gap: spacing.sm }}>
                <Button
                  label="Go Back to Safety"
                  onPress={() => setBlocked(null)}
                  gradient={[colors.safe, colors.primary]}
                />
                {blocked.verdict !== "critical" && (
                  <Pressable onPress={overrideAndOpen} style={{ padding: spacing.sm, alignItems: "center" }}>
                    <Text style={{ color: colors.textMuted, fontSize: 13, textDecorationLine: "underline" }}>
                      I understand the risk — open anyway
                    </Text>
                  </Pressable>
                )}
              </View>
            </Surface>
          </FadeIn>
        </View>
      )}

      {/* Live-protected WebView */}
      {page && !blocked && (
        <WebView
          ref={webRef}
          source={{ uri: page.url }}
          style={{ flex: 1 }}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onNavigationStateChange={(nav) => setCanGoBack(nav.canGoBack)}
          startInLoadingState
          renderLoading={() => (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
              <ActivityIndicator color={colors.primaryBright} size="large" />
            </View>
          )}
        />
      )}

      {/* Empty state */}
      {!page && !blocked && !checking && (
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
            Live Safe Browser
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 21 }}>
            Every page and every link you tap is checked in real time.
            Dangerous sites are blocked before they load.
          </Text>
        </View>
      )}

      {/* Full-screen checking state (first load) */}
      {!page && checking && !blocked && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.primaryBright} size="large" />
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: spacing.sm }}>Checking site safety…</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
