/**
 * Global JS error reporter.
 *
 * In release builds an uncaught JS error becomes RCTFatal -> SIGABRT, and the
 * TestFlight crash log keeps the native stack but drops the JS message — the
 * only part that says what actually broke. This hooks RN's global handler to
 * phone the message home (best-effort, fire-and-forget) before the app dies.
 * Reports land in the backend audit log as `mobile_js_error`.
 */
import Constants from "expo-constants";
import * as Updates from "expo-updates";

import { api } from "@/lib/api";

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsShape = {
  getGlobalHandler: () => GlobalErrorHandler;
  setGlobalHandler: (handler: GlobalErrorHandler) => void;
};

let installed = false;

function report(error: unknown, isFatal: boolean): void {
  try {
    const err = error as Error | undefined;
    api.post(
      "/monitoring/client-errors",
      {
        message: String(err?.message ?? error ?? "unknown").slice(0, 2000),
        stack: String(err?.stack ?? "").slice(0, 8000),
        is_fatal: isFatal,
        app_version: `${Constants.expoConfig?.version ?? "?"} (${Constants.expoConfig?.ios?.buildNumber ?? "?"})`,
        update_id: Updates.updateId ?? "embedded",
      },
      { timeout: 3000 }
    ).catch(() => {});
  } catch {
    // Reporting must never make a crash worse.
  }
}

export function installCrashReporter(): void {
  if (installed) return;
  installed = true;
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
  if (!errorUtils) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    report(error, Boolean(isFatal));
    previous?.(error, isFatal);
  });
}
