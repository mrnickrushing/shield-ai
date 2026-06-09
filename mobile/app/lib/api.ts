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

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

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

export type ScanType =
  | "link"
  | "image"
  | "qr"
  | "message"
  | "email"
  | "phone"
  | "marketplace"
  | "social";

export type Scan = {
  id: string;
  scan_type: ScanType;
  status: string;
  raw_input: string;
  created_at: string;
  completed_at: string | null;
  report: RiskReport | null;
};

export type UserProfile = {
  id: string;
  email: string;
  is_premium: boolean;
  display_name: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  scan_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type BreachInfo = {
  name: string;
  title: string;
  domain: string;
  breach_date: string;
  pwn_count: number;
  data_classes: string[];
  is_verified: boolean;
};

export type BreachResult = {
  email: string;
  breach_count: number;
  severity: "none" | "low" | "medium" | "high";
  breaches: BreachInfo[];
  actions: string[];
  disclaimer: string;
  data_available: boolean;
  checked_at: string;
};

export type IdentityAlert = {
  id: string;
  alert_type: string;
  email: string;
  detail: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
};

// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------

export const ShieldAPI = {
  // Auth
  register: (email: string, password: string, display_name: string) =>
    api.post("/auth/register", { email, password, display_name }).then((r) => r.data),
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }).then((r) => r.data),
  me: () => api.get<UserProfile>("/auth/me").then((r) => r.data),
  updateProfile: (display_name: string) =>
    api.patch<UserProfile>("/auth/me", { display_name }).then((r) => r.data),

  // Phase 1 scans
  scanLink: (url: string) =>
    api.post<Scan>("/scans/link", { url }).then((r) => r.data),
  scanImage: (image_base64: string, filename = "screenshot.png") =>
    api.post<Scan>("/scans/image", { image_base64, filename }).then((r) => r.data),

  // Phase 2 scans
  scanQR: (qr_content: string) =>
    api.post<Scan>("/scans/qr", { qr_content }).then((r) => r.data),
  scanMessage: (message_text: string, platform_hint = "") =>
    api.post<Scan>("/scans/message", { message_text, platform_hint }).then((r) => r.data),
  scanEmail: (payload: {
    raw_email?: string;
    sender_email?: string;
    sender_display_name?: string;
    reply_to_email?: string;
    subject?: string;
    body_text?: string;
  }) => api.post<Scan>("/scans/email", payload).then((r) => r.data),
  scanPhone: (phone_number: string) =>
    api.post<Scan>("/scans/phone", { phone_number }).then((r) => r.data),

  // Phase 3 scans
  scanMarketplace: (content_text: string, platform_hint = "") =>
    api.post<Scan>("/scans/marketplace", { content_text, platform_hint }).then((r) => r.data),
  scanSocial: (content_text: string, platform = "") =>
    api.post<Scan>("/scans/social", { content_text, platform }).then((r) => r.data),

  // Scan history
  listScans: () => api.get<Scan[]>("/scans").then((r) => r.data),
  getScan: (id: string) => api.get<Scan>(`/scans/${id}`).then((r) => r.data),
  feedback: (id: string, feedback: "helpful" | "false_positive") =>
    api.post(`/scans/${id}/feedback`, { feedback }),

  // Notifications
  registerDevice: (push_token: string, platform: "ios" | "android") =>
    api.post("/notifications/devices", { push_token, platform }),
  listNotifications: (unread_only = false) =>
    api.get<Notification[]>("/notifications", { params: { unread_only } }).then((r) => r.data),
  markNotificationRead: (id: string) =>
    api.post(`/notifications/${id}/read`),
  markAllNotificationsRead: () =>
    api.post("/notifications/read-all"),

  // Identity protection
  breachCheck: (email: string) =>
    api.post<BreachResult>("/identity/breach-check", { email }).then((r) => r.data),
  passwordCheck: (password: string) =>
    api
      .post<{ pwned_count: number; is_compromised: boolean; recommendation: string }>(
        "/identity/password-check",
        { password }
      )
      .then((r) => r.data),
  listIdentityAlerts: () =>
    api.get<IdentityAlert[]>("/identity/alerts").then((r) => r.data),
  markAlertRead: (id: string) => api.post(`/identity/alerts/${id}/read`),
};
