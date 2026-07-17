import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Pressable, Text, View } from "react-native";

import { ShieldAPI } from "@/lib/api";
import { appLockLifecycleTransition } from "@/lib/appLockLifecycle";
import { useAuth } from "@/state/auth";
import { colors, radius, spacing } from "@/theme/theme";

const CACHE_KEY = "requireDeviceUnlockCache";

/**
 * Enforces the "Require device unlock" privacy preference. Without this, the
 * toggle in Settings only persisted a value on the backend — nothing on the
 * client ever asked for Face ID / Touch ID / passcode, so the app opened
 * straight through regardless of the setting.
 */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const appState = useRef(AppState.currentState);
  const authenticationInFlight = useRef(false);
  const suppressForegroundRelock = useRef(false);
  const [cachedRequired, setCachedRequired] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(CACHE_KEY)
      .then((v) => setCachedRequired(v === "true"))
      .catch(() => setCachedRequired(false));
  }, []);

  const { data: privacy } = useQuery({
    queryKey: ["privacy-preferences"],
    queryFn: () => ShieldAPI.getPrivacyPreferences(),
    enabled: hydrated && Boolean(user?.id),
  });

  // required starts from the last-known cached value (so a cold launch locks
  // immediately, before the network round-trip resolves) and is replaced by
  // the live server value once it loads.
  const required = Boolean(user?.id) && (privacy ? privacy.require_device_unlock : cachedRequired ?? false);

  useEffect(() => {
    if (privacy) SecureStore.setItemAsync(CACHE_KEY, String(privacy.require_device_unlock)).catch(() => {});
  }, [privacy]);

  // Transparent while logged out; re-locks (subject to `required`) the
  // moment a real user loads, so a cold launch straight into a logged-in
  // session doesn't skip the gate until the next background/foreground.
  useEffect(() => {
    setUnlocked(!user?.id);
  }, [user?.id]);

  const attemptUnlock = useCallback(async () => {
    if (authenticationInFlight.current) return;
    authenticationInFlight.current = true;
    setChecking(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync());
      if (!enrolled) {
        // Nothing to authenticate against on this device — fail open rather
        // than permanently locking the user out of their own app.
        setUnlocked(true);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Shield AI",
        disableDeviceFallback: false,
      });
      setUnlocked(result.success);
    } finally {
      authenticationInFlight.current = false;
      setChecking(false);
    }
  }, []);

  // Auto-prompt exactly once each time the gate newly becomes locked. Keyed
  // off `required`/`unlocked` only (not `checking`) so a canceled or failed
  // attempt falls back to the manual "Unlock" button instead of the effect
  // immediately re-firing into a retry loop.
  const promptedRef = useRef(false);
  useEffect(() => {
    if (!required || unlocked) {
      promptedRef.current = false;
      return;
    }
    if (!promptedRef.current) {
      promptedRef.current = true;
      attemptUnlock();
    }
  }, [required, unlocked, attemptUnlock]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      const transition = appLockLifecycleTransition({
        previous: appState.current,
        next,
        required,
        authenticationInFlight: authenticationInFlight.current,
        suppressForegroundRelock: suppressForegroundRelock.current,
      });
      suppressForegroundRelock.current = transition.suppressForegroundRelock;
      if (transition.shouldRelock) {
        setUnlocked(false);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [required]);

  // Nothing has mounted yet on this very first render, so a blank frame here
  // costs nothing — but avoids briefly mounting protected screens underneath
  // before we know whether the cached preference says to lock them.
  if (Boolean(user?.id) && !privacy && cachedRequired === null) {
    return null;
  }

  return (
    <>
      {children}
      {required && !unlocked && (
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.bg,
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.xl,
            gap: spacing.md,
          }}
        >
          <Ionicons name="lock-closed-outline" size={48} color={colors.primaryBright} />
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Shield AI is locked</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: "center" }}>
            Unlock with your device passcode or biometrics to continue.
          </Text>
          <Pressable
            onPress={attemptUnlock}
            disabled={checking}
            style={{ backgroundColor: colors.surfaceActive, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>{checking ? "Checking..." : "Unlock"}</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}
