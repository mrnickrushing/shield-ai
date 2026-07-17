import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "";
let adminToken: string | null = null;

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 15000,
});

export function setToken(t: string) {
  adminToken = t;
  api.defaults.headers.common["Authorization"] = `Bearer ${t}`;
}

export function clearToken() {
  adminToken = null;
  delete api.defaults.headers.common["Authorization"];
  if (typeof window !== "undefined") window.localStorage.removeItem("shield_admin_token");
}

export function hydrateToken() {
  // Admin credentials intentionally live only in process memory. A refresh
  // requires re-authentication instead of leaving a bearer token available to
  // injected JavaScript in localStorage.
  if (typeof window !== "undefined") window.localStorage.removeItem("shield_admin_token");
  return adminToken;
}

export type AdminStats = {
  total_users: number;
  active_users: number;
  premium_users: number;
  developer_users: number;
  total_scans: number;
  scans_today: number;
  high_risk_scans: number;
  high_risk_scans_today: number;
  open_community_reports: number;
  pending_feedback_reviews: number;
  active_scam_patterns: number;
  active_api_keys: number;
  total_api_keys: number;
  revoked_api_keys: number;
  unread_notifications: number;
  open_incidents: number;
  monitored_identities: number;
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

export type AdminApiKey = {
  id: string;
  user_id: string;
  user_email: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
};

export type AuditLogEntry = {
  id: string;
  user_id: string | null;
  user_email: string;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
};

export type AdminUserDetail = {
  user: AdminUser;
  subscription: Record<string, unknown>;
  privacy: Record<string, unknown> | null;
  counts: Record<string, number>;
  sessions: Array<Record<string, unknown>>;
  devices: Array<Record<string, unknown>>;
  api_keys: AdminApiKey[];
  scans: Array<Record<string, unknown>>;
  incidents: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  identity_alerts: Array<Record<string, unknown>>;
  monitored_identities: Array<Record<string, unknown>>;
  audit_logs: AuditLogEntry[];
};

export type NotificationDiagnostics = {
  total_notifications: number;
  unread_notifications: number;
  active_devices: number;
  identity_alerts: number;
  recent_notifications: Array<Record<string, unknown>>;
  possible_duplicates: Array<Record<string, unknown>>;
};

export type SubscriptionDiagnostics = {
  premium_users: number;
  with_product_id: number;
  expired_premium: number;
  users: Array<Record<string, unknown>>;
};

export type OperationsOverview = {
  today: Record<string, number>;
  risk_today: Record<string, number>;
  categories_today: Record<string, number>;
  queues: Record<string, number>;
  telemetry: Record<string, number>;
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
  operations: () => api.get<OperationsOverview>("/admin/operations"),
  users: () => api.get<AdminUser[]>("/admin/users"),
  userDetail: (id: string) => api.get<AdminUserDetail>(`/admin/users/${id}`),
  updateUser: (id: string, payload: UpdateUserPayload) =>
    api.patch<AdminUser>(`/admin/users/${id}`, payload),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  revokeUserSessions: (id: string) => api.post(`/admin/users/${id}/revoke-sessions`),
  disableUserApiKeys: (id: string) => api.post(`/admin/users/${id}/disable-api-keys`),
  apiKeys: (statusFilter?: string) =>
    api.get<AdminApiKey[]>("/admin/api-keys", { params: statusFilter ? { status_filter: statusFilter } : {} }),
  updateApiKey: (id: string, is_active: boolean) =>
    api.patch(`/admin/api-keys/${id}`, { is_active }),
  auditLogs: (userId?: string) =>
    api.get<AuditLogEntry[]>("/admin/audit-logs", { params: userId ? { user_id: userId } : {} }),
  notificationDiagnostics: () => api.get<NotificationDiagnostics>("/admin/notifications/diagnostics"),
  createTestNotification: (user_id: string, title: string, body: string) =>
    api.post("/admin/notifications/test", { user_id, title, body }),
  subscriptionDiagnostics: () => api.get<SubscriptionDiagnostics>("/admin/subscriptions/diagnostics"),

  reports: (statusFilter?: string) =>
    api.get<CommunityReport[]>("/admin/reports", { params: statusFilter ? { status_filter: statusFilter } : {} }),
  reviewReport: (id: string, status: string, analyst_notes: string) =>
    api.patch<CommunityReport>(`/admin/reports/${id}`, { status, analyst_notes }),
  deactivateSeededNumber: (number: string) =>
    api.patch(`/admin/seeded-numbers/${encodeURIComponent(number)}`, { is_active: false }),

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
