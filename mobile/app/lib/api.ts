// API client with token storage + auto-attach + refresh.
import axios from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

export const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string) ??
  process.env.EXPO_PUBLIC_API_URL ??
  "https://api.shieldai.rushingtechnologies.com";

export const api = axios.create({ baseURL: `${API_URL}/api/v1`, timeout: 30000 });

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
export async function getAccessToken() { return SecureStore.getItemAsync(ACCESS_KEY); }

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
          const { data } = await axios.post(`${API_URL}/api/v1/auth/refresh`, { refresh_token: refresh });
          await saveTokens(data.access_token, data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch { await clearTokens(); }
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
  | "social"
  | "vertical";

export type Scan = {
  id: string;
  scan_type: ScanType;
  vertical_key?: string | null;
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

export type UrlVerdict = {
  url: string;
  domain: string;
  verdict: "safe" | "low" | "suspicious" | "high" | "critical";
  score: number;
  reason: string;
  cached: boolean;
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

export type Notification = {
  id: string;
  title: string;
  body: string;
  scan_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type NotificationPreferences = {
  push_enabled: boolean;
  email_enabled: boolean;
  proactive_monitoring: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  minimum_severity: "all" | "low" | "suspicious" | "high" | "critical";
  topics: Record<string, boolean>;
  updated_at?: string;
};

export type PrivacyPreferences = {
  retention_days: number | null;
  require_device_unlock: boolean;
  updated_at?: string;
};

export type DeviceSession = {
  id: string;
  platform: string;
  label: string;
  push_token: string;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
};

export type AuthSession = {
  id: string;
  user_agent: string;
  ip_address: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  revoked_at: string | null;
};

export type AccountExport = {
  exported_at: string;
  user: UserProfile;
  scans: Scan[];
  incidents: Incident[];
  notifications: Notification[];
  community_reports: CommunityReportOut[];
  identity_alerts: IdentityAlert[];
  devices: DeviceSession[];
  sessions: AuthSession[];
  privacy_preferences: PrivacyPreferences;
  notification_preferences: NotificationPreferences | null;
  scan_feedback_details: unknown[];
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

export type BrokerStatus = "not_started" | "not_listed" | "found" | "requested" | "removed";

export type BrokerExposureItem = {
  key: string;
  name: string;
  priority: number;
  search_url: string;
  opt_out_url: string;
  instructions: string;
  expected_days: number;
  status: BrokerStatus;
  notes: string;
  requested_at: string | null;
  updated_at: string | null;
};

export type BrokerExposureSummary = {
  total: number;
  resolved: number;
  in_progress: number;
  not_started: number;
  exposure_score: number;
  brokers: BrokerExposureItem[];
};

export type MonitoredIdentity = {
  id: string;
  target_type: "email" | "phone" | "username" | "domain";
  value: string;
  label: string;
  is_active: boolean;
  last_checked_at: string | null;
  last_status: string;
  created_at: string;
};

export type ApiKeyOut = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
};

export type ApiKeyCreated = ApiKeyOut & { raw_key: string };

export type CommunityReportType = "false_positive" | "missed_scam" | "new_pattern";

export type CommunityReportOut = {
  id: string;
  report_type: CommunityReportType;
  artifact_text: string;
  category: string;
  platform_hint: string;
  status: string;
  created_at: string;
};

export type ScamPatternOut = {
  id: string;
  name: string;
  description: string;
  pattern_type: string;
  artifact_types: string[];
  risk_score_boost: number;
  category: string;
  is_active: boolean;
  source: string;
  created_at: string;
};

export type PhoneReputationEntry = {
  number: string;
  label: string;
};

export type PhoneReputationSync = {
  version: string;
  entries: PhoneReputationEntry[];
};

export type EmailScanPayload = {
  raw_email?: string;
  sender_email?: string;
  sender_display_name?: string;
  reply_to_email?: string;
  subject?: string;
  body_text?: string;
};

// Shield Labs — portfolio verticals on the shared Verdict Engine
export type VerticalInfo = {
  key: string;
  name: string;
  tagline: string;
  accent: string;
  icon: string;
  input_label: string;
  input_placeholder: string;
  input_multiline: boolean;
  accepts_files: boolean;
};

export type Verdict = {
  vertical: string;
  vertical_name: string;
  risk_score: number;
  risk_level: "safe" | "low" | "suspicious" | "high" | "critical";
  threat_category: string;
  confidence: number;
  explanation: string;
  red_flags: string[];
  recommended_actions: string[];
  evidence: Record<string, unknown>;
  output_title: string;
  output_artifact: string;
};

// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------

export const ShieldAPI = {
  register: (email: string, password: string, display_name: string) => api.post("/auth/register", { email, password, display_name }).then((r) => r.data),
  login: (email: string, password: string) => api.post("/auth/login", { email, password }).then((r) => r.data),
  me: () => api.get<UserProfile>("/auth/me").then((r) => r.data),
  socialAuth: (provider: "apple" | "google", token: string, email?: string, display_name?: string) =>
    api.post<{ access_token: string; refresh_token: string }>("/auth/social", { provider, token, email, display_name }).then((r) => r.data),
  googleAuthStartUrl: (return_url: string) =>
    `${API_URL}/api/v1/auth/google/start?return_url=${encodeURIComponent(return_url)}`,
  updateProfile: (patch: { display_name?: string; large_text_mode?: boolean; simple_language_mode?: boolean }) => api.patch<UserProfile>("/auth/me", patch).then((r) => r.data),
  exportAccountData: () => api.get<AccountExport>("/auth/me/export").then((r) => r.data),
  getPrivacyPreferences: () => api.get<PrivacyPreferences>("/auth/me/privacy").then((r) => r.data),
  updatePrivacyPreferences: (payload: PrivacyPreferences) => api.put<PrivacyPreferences>("/auth/me/privacy", payload).then((r) => r.data),
  listSessions: () => api.get<AuthSession[]>("/auth/me/sessions").then((r) => r.data),
  revokeSession: (id: string) => api.delete(`/auth/me/sessions/${id}`),
  listDevices: () => api.get<DeviceSession[]>("/auth/me/devices").then((r) => r.data),
  revokeDevice: (id: string) => api.delete(`/auth/me/devices/${id}`),
  purgeScanHistory: () => api.delete<{ deleted_scans: number }>("/auth/me/scan-history").then((r) => r.data),
  deleteAccount: () => api.delete("/auth/me"),
  scanLink: (url: string) => api.post<Scan>("/scans/link", { url }).then((r) => r.data),
  // Live Safe Browser: fast verdict, no history/quota. Short timeout — it
  // sits in the navigation path and the browser fails open to "unverified".
  checkUrl: (url: string) =>
    api.get<UrlVerdict>("/scans/url-check", { params: { url }, timeout: 8000 }).then((r) => r.data),
  // Claude vision + OCR + URL enrichment routinely runs past the default
  // 30s timeout, which surfaces as a response-less error here — give image
  // scans more headroom than the rest of the API.
  scanImage: (image_base64: string, filename = "screenshot.png") =>
    api.post<Scan>("/scans/image", { image_base64, filename }, { timeout: 60000 }).then((r) => r.data),
  scanQR: (qr_content: string) => api.post<Scan>("/scans/qr", { qr_content }).then((r) => r.data),
  scanMessage: (message_text: string, platform_hint?: string) =>
    api.post<Scan>("/scans/message", { message_text, platform_hint }).then((r) => r.data),
  scanEmail: (payload: EmailScanPayload) =>
    api.post<Scan>("/scans/email", payload).then((r) => r.data),
  scanPhone: (phone_number: string) =>
    api.post<Scan>("/scans/phone", { phone_number }).then((r) => r.data),
  scanMarketplace: (content_text: string, platform_hint?: string) =>
    api.post<Scan>("/scans/marketplace", { content_text, platform_hint }).then((r) => r.data),
  scanSocial: (content_text: string, platform?: string) =>
    api.post<Scan>("/scans/social", { content_text, platform }).then((r) => r.data),
  listScans: () => api.get<Scan[]>("/scans").then((r) => r.data),
  getScan: (id: string) => api.get<Scan>(`/scans/${id}`).then((r) => r.data),
  feedback: (id: string, feedback: "helpful" | "false_positive") =>
    api.post(`/scans/${id}/feedback`, { feedback }),
  feedbackDetail: (id: string, payload: { feedback: "helpful" | "false_positive" | "missed_scam"; reason?: string; corrected_context?: string; evidence?: string }) =>
    api.post(`/scans/${id}/feedback-detail`, payload).then((r) => r.data),

  // Shield Labs — portfolio verticals
  listVerticals: () => api.get<VerticalInfo[]>("/verticals").then((r) => r.data),
  scanVertical: (key: string, input: string, context: Record<string, unknown> = {}) =>
    api.post<Verdict>(`/verticals/${key}/scan`, { input, context }).then((r) => r.data),
  scanVerticalFile: (key: string, file_base64: string, context: Record<string, unknown> = {}) =>
    api.post<Verdict>(`/verticals/${key}/scan`, { file_base64, context }).then((r) => r.data),

  // Notifications
  registerDevice: (push_token: string, platform: "ios" | "android") =>
    api.post("/notifications/devices", { push_token, platform, label: `${platform.toUpperCase()} Device` }),
  getNotificationPreferences: () =>
    api.get<NotificationPreferences>("/notifications/preferences").then((r) => r.data),
  updateNotificationPreferences: (payload: NotificationPreferences) =>
    api.put<NotificationPreferences>("/notifications/preferences", payload).then((r) => r.data),
  listNotifications: (unread_only = false) =>
    api.get<Notification[]>("/notifications", { params: { unread_only } }).then((r) => r.data),
  markNotificationRead: (id: string) =>
    api.post(`/notifications/${id}/read`),
  markAllNotificationsRead: () =>
    api.post("/notifications/read-all"),

  // Recovery wizard
  getWizardSteps: (incident_type: string) =>
    api.get(`/recovery/wizard/${incident_type}`).then((r) => r.data),
  createIncident: (payload: { incident_type: string; linked_scan_id?: string; title?: string }) =>
    api.post<Incident>("/recovery/incidents", payload).then((r) => r.data),
  listIncidents: () =>
    api.get<Incident[]>("/recovery/incidents").then((r) => r.data),
  getIncident: (id: string) =>
    api.get<Incident>(`/recovery/incidents/${id}`).then((r) => r.data),
  updateIncident: (id: string, payload: Partial<Incident>) =>
    api.patch<Incident>(`/recovery/incidents/${id}`, payload).then((r) => r.data),
  addEvidence: (incident_id: string, payload: { evidence_type: string; content: string; label?: string }) =>
    api.post(`/recovery/incidents/${incident_id}/evidence`, payload).then((r) => r.data),
  getIncidentSummary: (id: string) =>
    api.get(`/recovery/incidents/${id}/summary`).then((r) => r.data),
  getIncidentCasePack: (id: string, format: "json" | "text" | "pdf" = "json") =>
    api.get(`/recovery/incidents/${id}/case-pack`, { params: { format } }).then((r) => r.data),
  createCasePackShare: (id: string) =>
    api.post<{ url: string; pdf_url: string; expires_at: string }>(`/recovery/incidents/${id}/share`).then((r) => r.data),

  // Family protection
  listContacts: () =>
    api.get<TrustedContact[]>("/family/contacts").then((r) => r.data),
  addContact: (payload: { name: string; phone?: string; email?: string; relationship_label?: string }) =>
    api.post<TrustedContact>("/family/contacts", payload).then((r) => r.data),
  removeContact: (id: string) =>
    api.delete(`/family/contacts/${id}`),

  // Education
  listLessons: (threat_category?: string) =>
    api.get("/education/lessons", { params: threat_category ? { threat_category } : {} }).then((r) => r.data),
  getLesson: (id: string) =>
    api.get(`/education/lessons/${id}`).then((r) => r.data),
  completeLesson: (id: string, payload: { answers: number[] }) =>
    api.post(`/education/lessons/${id}/complete`, payload).then((r) => r.data),

  // Identity protection
  breachCheck: (email: string) =>
    api.post<BreachResult>("/identity/breach-check", { email }).then((r) => r.data),
  passwordCheck: (password: string) =>
    api.post<{ pwned_count: number; is_compromised: boolean; recommendation: string }>(
      "/identity/password-check",
      { password }
    ).then((r) => r.data),
  listIdentityAlerts: () =>
    api.get<IdentityAlert[]>("/identity/alerts").then((r) => r.data),
  markAlertRead: (id: string) =>
    api.post(`/identity/alerts/${id}/read`),
  brokerExposure: () =>
    api.get<BrokerExposureSummary>("/identity/brokers").then((r) => r.data),
  updateBrokerStatus: (broker_key: string, status: BrokerStatus, notes?: string) =>
    api.put<BrokerExposureItem>(`/identity/brokers/${broker_key}`, { status, notes: notes ?? "" }).then((r) => r.data),

  // Real-time monitoring
  listMonitoringTargets: () =>
    api.get<MonitoredIdentity[]>("/monitoring/targets").then((r) => r.data),
  addMonitoringTarget: (payload: { target_type: "email" | "phone" | "username" | "domain"; value: string; label?: string }) =>
    api.post<MonitoredIdentity>("/monitoring/targets", payload).then((r) => r.data),
  removeMonitoringTarget: (id: string) =>
    api.delete(`/monitoring/targets/${id}`),
  recordBrowserEvent: (payload: { url: string; domain?: string; verdict: string; action: "viewed" | "blocked" | "allowed" | "trusted" | "override"; reason?: string }) =>
    api.post("/monitoring/browser-events", payload),
  recordExtensionEvent: (payload: { extension_type: "message_filter" | "call_directory" | "widget" | "share"; event_type: string; counts?: Record<string, unknown>; detail?: Record<string, unknown> }) =>
    api.post("/monitoring/extension-events", payload),
  monitoringSummary: () =>
    api.get("/monitoring/summary").then((r) => r.data),

  // Community reporting
  submitReport: (payload: { scan_id?: string; report_type: CommunityReportType; artifact_text?: string; category?: string; platform_hint?: string }) =>
    api.post<CommunityReportOut>("/community/reports", payload).then((r) => r.data),
  listMyReports: () =>
    api.get<CommunityReportOut[]>("/community/reports").then((r) => r.data),
  listPublicPatterns: () =>
    api.get<ScamPatternOut[]>("/community/patterns").then((r) => r.data),

  // Phone reputation — Call Directory Extension sync
  syncPhoneReputation: () =>
    api.get<PhoneReputationSync>("/phone-reputation/sync").then((r) => r.data),

  // Developer API key management
  createApiKey: (name: string, scopes = ["scan:read", "scan:write"]) =>
    api.post<ApiKeyCreated>("/developer/keys", { name, scopes }).then((r) => r.data),
  listApiKeys: () =>
    api.get<ApiKeyOut[]>("/developer/keys").then((r) => r.data),
  revokeApiKey: (id: string) =>
    api.delete(`/developer/keys/${id}`),
};
