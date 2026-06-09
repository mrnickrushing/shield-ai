// Lightweight auth store with Zustand.
import { create } from "zustand";

import { ShieldAPI, clearTokens, getAccessToken, saveTokens } from "@/lib/api";

type User = { id: string; email: string; is_premium: boolean; display_name: string };

type AuthState = {
  user: User | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
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
  logout: async () => {
    await clearTokens();
    set({ user: null });
  },
}));
