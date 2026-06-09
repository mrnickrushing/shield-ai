import { create } from "zustand";

import { ShieldAPI, UserProfile, clearTokens, getAccessToken, saveTokens } from "@/lib/api";

type ProfilePatch = { display_name?: string; large_text_mode?: boolean; simple_language_mode?: boolean };

type AuthState = {
  user: UserProfile | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithSocial: (provider: "apple" | "google", token: string, email?: string, displayName?: string) => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  hydrated: false,

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

  loginWithSocial: async (provider, token, email, displayName) => {
    const tokens = await ShieldAPI.socialAuth(provider, token, email, displayName);
    await saveTokens(tokens.access_token, tokens.refresh_token);
    set({ user: await ShieldAPI.me() });
  },

  updateProfile: async (patch) => {
    const user = await ShieldAPI.updateProfile(patch);
    set({ user });
  },

  logout: async () => {
    await clearTokens();
    set({ user: null });
  },
}));
