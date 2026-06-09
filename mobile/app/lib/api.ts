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
  scan_type: "link" | "image" | "qr" | "message" | "email" | "phone";
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
  simple_language_mode: boolean;
  large_text_mode: boolean;
};

export type Incident = {
  id: string;
  incident_type: string;
  status: string;
  title: string;
  amount_lost: number | null;
  currency: string;
  notes: string;
  linked_scan_id: string | null;
  steps_completed: string[];
  created_at: string;
  updated_at: string;
};

export type TrustedContact = {
  id: string;
  name: string;
  phone: string;
  email: string;
  relationship_label: string;
  created_at: string;
};

export const ShieldAPI = {
  // Auth
  register: (email: string, password: string, display_name: string) =>
    api.post("/auth/register", { email, password, display_name }).then((r) => r.data),
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }).then((r) => r.data),
  me: () => api.get<UserProfile>("/auth/me").then((r) => r.data),
  updateProfile: (display_name: string) =>
    api.patch<UserProfile>("/auth/me", { display_name }).then((r) => r.data),

  // Scans
  scanLink: (url: string) => api.post<Scan>("/scans/link", { url }).then((r) => r.data),
  scanImage: (image_base64: string, filename = "screenshot.png") =>
    api.post<Scan>("/scans/image", { image_base64, filename }).then((r) => r.data),
  listScans: () => api.get<Scan[]>("/scans").then((r) => r.data),
  getScan: (id: string) => api.get<Scan>(`/scans/${id}`).then((r) => r.data),
  feedback: (id: string, feedback: "helpful" | "false_positive") =>
    api.post(`/scans/${id}/feedback`, { feedback }),

  // Recovery
  getWizardSteps: (incident_type: string) =>
    api.get(`/recovery/wizard/${incident_type}`).then((r) => r.data),
  createIncident: (payload: { incident_type: string; linked_scan_id?: string; title?: string }) =>
    api.post<Incident>("/recovery/incidents", payload).then((r) => r.data),
  listIncidents: () => api.get<Incident[]>("/recovery/incidents").then((r) => r.data),
  getIncident: (id: string) => api.get<Incident>(`/recovery/incidents/${id}`).then((r) => r.data),
  updateIncident: (id: string, payload: Partial<Incident>) =>
    api.patch<Incident>(`/recovery/incidents/${id}`, payload).then((r) => r.data),
  addEvidence: (incident_id: string, payload: { evidence_type: string; content: string; label?: string }) =>
    api.post(`/recovery/incidents/${incident_id}/evidence`, payload).then((r) => r.data),
  getIncidentSummary: (id: string) =>
    api.get(`/recovery/incidents/${id}/summary`).then((r) => r.data),

  // Family
  listContacts: () => api.get<TrustedContact[]>("/family/contacts").then((r) => r.data),
  addContact: (payload: { name: string; phone?: string; email?: string; relationship_label?: string }) =>
    api.post<TrustedContact>("/family/contacts", payload).then((r) => r.data),
  removeContact: (id: string) => api.delete(`/family/contacts/${id}`),

  // Education
  listLessons: (threat_category?: string) => {
    const params = threat_category ? { threat_category } : {};
    return api.get("/education/lessons", { params }).then((r) => r.data);
  },
  getLesson: (id: string) => api.get(`/education/lessons/${id}`).then((r) => r.data),
  completeLesson: (id: string, payload: { answers: number[] }) =>
    api.post(`/education/lessons/${id}/complete`, payload).then((r) => r.data),
};
