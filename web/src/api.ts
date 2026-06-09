import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "";

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 15000,
});

let _token = localStorage.getItem("admin_token") ?? "";

export function setToken(t: string) {
  _token = t;
  localStorage.setItem("admin_token", t);
  api.defaults.headers.common["Authorization"] = `Bearer ${t}`;
}

export function clearToken() {
  _token = "";
  localStorage.removeItem("admin_token");
  delete api.defaults.headers.common["Authorization"];
}

if (_token) {
  api.defaults.headers.common["Authorization"] = `Bearer ${_token}`;
}

export type AdminStats = {
  total_users: number;
  total_scans: number;
  scans_today: number;
  open_community_reports: number;
  active_scam_patterns: number;
  active_api_keys: number;
};

export type AdminUser = {
  id: string;
  email: string;
  is_premium: boolean;
  is_admin: boolean;
  is_developer: boolean;
  is_active: boolean;
  created_at: string;
};

export type CommunityReport = {
  id: string;
  user_id: string | null;
  scan_id: string | null;
  report_type: string;
  artifact_text: string;
  category: string;
  platform_hint: string;
  status: string;
  analyst_notes: string;
  created_at: string;
};

export type ScamPattern = {
  id: string;
  name: string;
  description: string;
  pattern_type: string;
  artifact_types: string[];
  pattern_data: Record<string, unknown>;
  risk_score_boost: number;
  category: string;
  is_active: boolean;
  source: string;
  created_at: string;
};

type UpdateUserPayload = Partial<Pick<AdminUser, "is_premium" | "is_admin" | "is_developer" | "is_active">>;
type CreatePatternPayload = {
  name: string;
  description: string;
  pattern_type: string;
  artifact_types: string[];
  pattern_data: Record<string, unknown>;
  risk_score_boost: number;
  category: string;
  source?: string;
};
type UpdatePatternPayload = Partial<Pick<ScamPattern, "description" | "is_active" | "risk_score_boost" | "category" | "pattern_data" | "artifact_types">>;

export const AdminAPI = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string; refresh_token: string }>("/auth/login", { email, password }),

  stats: () => api.get<AdminStats>("/admin/stats"),
  users: () => api.get<AdminUser[]>("/admin/users"),
  updateUser: (id: string, payload: UpdateUserPayload) =>
    api.patch<AdminUser>(`/admin/users/${id}`, payload),

  reports: (statusFilter?: string) =>
    api.get<CommunityReport[]>("/admin/reports", { params: statusFilter ? { status_filter: statusFilter } : {} }),
  reviewReport: (id: string, status: string, analyst_notes: string) =>
    api.patch<CommunityReport>(`/admin/reports/${id}`, { status, analyst_notes }),

  patterns: () => api.get<ScamPattern[]>("/admin/patterns"),
  createPattern: (payload: CreatePatternPayload | Partial<ScamPattern>) =>
    api.post<ScamPattern>("/admin/patterns", payload),
  updatePattern: (id: string, payload: UpdatePatternPayload) =>
    api.patch<ScamPattern>(`/admin/patterns/${id}`, payload),
  deletePattern: (id: string) => api.delete(`/admin/patterns/${id}`),
};
