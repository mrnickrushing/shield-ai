import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "";
const ADMIN_TOKEN_KEY = "shield_admin_token";

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 15000,
});

export function setToken(t: string) {
  api.defaults.headers.common["Authorization"] = `Bearer ${t}`;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ADMIN_TOKEN_KEY, t);
  }
}

export function clearToken() {
  delete api.defaults.headers.common["Authorization"];
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

export function hydrateToken() {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }
  return token;
}

export type AdminStats = {
  total_users: number;
  total_scans: number;
  scans_today: number;
  open_community_reports: number;
  pending_feedback_reviews: number;
  active_scam_patterns: number;
  active_api_keys: number;
  total_api_keys: number;
  revoked_api_keys: number;
};

export type AdminUser = {
  id: string;
  email: string;
  is_premium: boolean;
  is_admin: boolean;
  is_developer: boolean;
  is_active: boolean;
  active_api_keys: number;
  total_api_keys: number;
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

export type FeedbackReview = {
  id: string;
  user_id: string;
  scan_id: string;
  scan_type: string;
  raw_input: string;
  feedback: string;
  reason: string;
  corrected_context: string;
  evidence: string;
  review_status: string;
  created_at: string;
  risk_level: string;
  threat_category: string;
  risk_score: number | null;
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
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),

  reports: (statusFilter?: string) =>
    api.get<CommunityReport[]>("/admin/reports", { params: statusFilter ? { status_filter: statusFilter } : {} }),
  reviewReport: (id: string, status: string, analyst_notes: string) =>
    api.patch<CommunityReport>(`/admin/reports/${id}`, { status, analyst_notes }),

  feedback: (statusFilter?: string) =>
    api.get<FeedbackReview[]>("/admin/feedback", { params: statusFilter ? { status_filter: statusFilter } : {} }),
  reviewFeedback: (id: string, review_status: string) =>
    api.patch(`/admin/feedback/${id}`, { review_status }),
  promoteFeedbackToPattern: (id: string, payload: CreatePatternPayload) =>
    api.post<ScamPattern>(`/admin/feedback/${id}/pattern`, payload),

  patterns: () => api.get<ScamPattern[]>("/admin/patterns"),
  createPattern: (payload: CreatePatternPayload | Partial<ScamPattern>) =>
    api.post<ScamPattern>("/admin/patterns", payload),
  updatePattern: (id: string, payload: UpdatePatternPayload) =>
    api.patch<ScamPattern>(`/admin/patterns/${id}`, payload),
  deletePattern: (id: string) => api.delete(`/admin/patterns/${id}`),
};
