// API client with token storage + auto-attach + refresh.
import axios from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string) ??
  process.env.EXPO_PUBLIC_API_URL ??
  "http://localhost:8000";

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 30000,
});

const ACCESS_KEY = "shield_access_token";
const REFRESH_KEY = "shield_refresh_token";

export async function saveTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync(ACCESS_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, try a one-time refresh.
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
            refresh_token: refresh,
          });
          await saveTokens(data.access_token, data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          await clearTokens();
        }
      }
    }
    return Promise.reject(error);
  }
);

// --- Typed endpoints ---
export type RiskReport = {
  risk_score: number;
  risk_level: "safe" | "low" | "suspicious" | "high" | "critical";
  threat_category: string;
  confidence: number;
  explanation: string;
  red_flags: string[];
  recommended_actions: string[];
  evidence: Record<string, unknown>;
};

export type Scan = {
  id: string;
  scan_type: "link" | "image";
  status: string;
  raw_input: string;
  created_at: string;
  completed_at: string | null;
  report: RiskReport | null;
};

export const ShieldAPI = {
  register: (email: string, password: string, display_name: string) =>
    api.post("/auth/register", { email, password, display_name }).then((r) => r.data),
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }).then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
  scanLink: (url: string) =>
    api.post<Scan>("/scans/link", { url }).then((r) => r.data),
  scanImage: (image_base64: string, filename = "screenshot.png") =>
    api.post<Scan>("/scans/image", { image_base64, filename }).then((r) => r.data),
  listScans: () => api.get<Scan[]>("/scans").then((r) => r.data),
  getScan: (id: string) => api.get<Scan>(`/scans/${id}`).then((r) => r.data),
  feedback: (id: string, feedback: "helpful" | "false_positive") =>
    api.post(`/scans/${id}/feedback`, { feedback }),
};
