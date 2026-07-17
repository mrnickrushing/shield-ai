import type { AppStateStatus } from "react-native";

type AppLockLifecycleInput = {
  previous: AppStateStatus;
  next: AppStateStatus;
  required: boolean;
  authenticationInFlight: boolean;
  suppressForegroundRelock: boolean;
};

type AppLockLifecycleResult = {
  shouldRelock: boolean;
  suppressForegroundRelock: boolean;
};

/**
 * Distinguish a genuine foreground resume from the temporary iOS app-state
 * transition caused by the Face ID / Touch ID system dialog.
 *
 * The active event can arrive before or after authenticateAsync resolves, so
 * suppression is latched when authentication moves the app away from active
 * and consumed on the matching foreground event.
 */
export function appLockLifecycleTransition({
  previous,
  next,
  required,
  authenticationInFlight,
  suppressForegroundRelock,
}: AppLockLifecycleInput): AppLockLifecycleResult {
  const authenticationMovedAppAway = next !== "active" && authenticationInFlight;
  const suppressResume = suppressForegroundRelock || authenticationMovedAppAway;
  const returnedToForeground = (previous === "inactive" || previous === "background") && next === "active";

  return {
    shouldRelock: returnedToForeground && required && !suppressResume,
    suppressForegroundRelock: returnedToForeground ? false : suppressResume,
  };
}
