import { create } from "zustand";

import { ShieldAPI, UserProfile, clearTokens, getAccessToken, saveTokens } from "@/lib/api";
import { logOutRevenueCat } from "@/lib/revenuecat";

type ProfilePatch = { display_name?: string; large_text_mode?: boolean; simple_language_mode?: boolean };

type AuthState = {
  user: UserProfile | null;
  hydrated: boolean;
  /** True when the RevenueCat `premium` entitlement is active on this device. */
  rcPremium: boolean;
  setRcPremium: (active: boolean) => void;
  refreshUser: () => Promise<void>;
  hydrate: () => Promise<void>;
  acceptTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithSocial: (provider: "apple" | "google", token: string, email?: string, displayName?: string, nonce?: string) => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  logout: () => Promise<void>;
};

/** Premium if either source says so: RevenueCat (instant after purchase) or the backend (webhook-synced). */
export const useIsPremium = () => useAuth((s) => s.rcPremium || Boolean(s.user?.is_premium));

export const useAuth = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  rcPremium: false,

  setRcPremium: (active) => set({ rcPremium: active }),

  refreshUser: async () => {
    try {
      set({ user: await ShieldAPI.me() });
    } catch {
      // Keep the cached user on transient network errors.
    }
  },

  hydrate: async () => {
    const token = await getAccessToken();
    if (token) {
      try {
        const user = await ShieldAPI.me();
        set({ user });
      } catch {
        await clearTokens();
      }
    }
    set({ hydrated: true });
  },

  acceptTokens: async (accessToken, refreshToken) => {
    await saveTokens(accessToken, refreshToken);
    set({ user: await ShieldAPI.me() });
  },

  login: async (email, password) => {
    const tokens = await ShieldAPI.login(email, password);
    await saveTokens(tokens.access_token, tokens.refresh_token);
    set({ user: await ShieldAPI.me() });
  },

  register: async (email, password, name) => {
    const tokens = await ShieldAPI.register(email, password, name);
    await saveTokens(tokens.access_token, tokens.refresh_token);
    set({ user: await ShieldAPI.me() });
  },

  loginWithSocial: async (provider, token, email, displayName, nonce) => {
    const tokens = await ShieldAPI.socialAuth(provider, token, email, displayName, nonce);
    await saveTokens(tokens.access_token, tokens.refresh_token);
    set({ user: await ShieldAPI.me() });
  },

  updateProfile: async (patch) => {
    const user = await ShieldAPI.updateProfile(patch);
    set({ user });
  },

  logout: async () => {
    await clearTokens();
    await logOutRevenueCat();
    set({ user: null, rcPremium: false });
  },
}));
