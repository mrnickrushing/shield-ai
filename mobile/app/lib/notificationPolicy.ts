import type { Notification } from "@/lib/api";

const CRITICAL_SEVERITIES = new Set(["suspicious", "high", "critical"]);
const ALLOWED_ROUTE_PREFIXES = [
  "/notifications",
  "/result",
  "/identity",
  "/recovery",
  "/incident",
  "/exposure",
  "/call-protection",
  "/protection",
  "/report",
];

export function isCriticalAlert(item: Pick<Notification, "severity">): boolean {
  return CRITICAL_SEVERITIES.has(item.severity);
}

export function safeNotificationRoute(route: string | null | undefined, scanId?: string | null): string {
  const fallback = scanId ? `/result?id=${encodeURIComponent(scanId)}` : "/notifications";
  if (!route || !route.startsWith("/") || route.startsWith("//") || route.includes("..") || route.includes("\\")) {
    return fallback;
  }
  const path = route.split("?", 1)[0];
  return ALLOWED_ROUTE_PREFIXES.some((prefix) => path === prefix) ? route : fallback;
}
