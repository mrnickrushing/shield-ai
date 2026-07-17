import { describe, expect, it } from "vitest";

import { appLockLifecycleTransition } from "../app/lib/appLockLifecycle";

describe("app lock lifecycle", () => {
  it("relocks after a genuine background resume", () => {
    expect(appLockLifecycleTransition({
      previous: "background",
      next: "active",
      required: true,
      authenticationInFlight: false,
      suppressForegroundRelock: false,
    })).toEqual({ shouldRelock: true, suppressForegroundRelock: false });
  });

  it("does not relock when the Face ID active event arrives before authentication resolves", () => {
    const interrupted = appLockLifecycleTransition({
      previous: "active",
      next: "inactive",
      required: true,
      authenticationInFlight: true,
      suppressForegroundRelock: false,
    });

    expect(interrupted).toEqual({ shouldRelock: false, suppressForegroundRelock: true });
    expect(appLockLifecycleTransition({
      previous: "inactive",
      next: "active",
      required: true,
      authenticationInFlight: true,
      suppressForegroundRelock: interrupted.suppressForegroundRelock,
    })).toEqual({ shouldRelock: false, suppressForegroundRelock: false });
  });

  it("does not relock when the Face ID active event arrives after authentication resolves", () => {
    const interrupted = appLockLifecycleTransition({
      previous: "active",
      next: "inactive",
      required: true,
      authenticationInFlight: true,
      suppressForegroundRelock: false,
    });

    expect(appLockLifecycleTransition({
      previous: "inactive",
      next: "active",
      required: true,
      authenticationInFlight: false,
      suppressForegroundRelock: interrupted.suppressForegroundRelock,
    })).toEqual({ shouldRelock: false, suppressForegroundRelock: false });
  });

  it("preserves the original inactive-to-active lock when no authentication prompt caused it", () => {
    expect(appLockLifecycleTransition({
      previous: "inactive",
      next: "active",
      required: true,
      authenticationInFlight: false,
      suppressForegroundRelock: false,
    }).shouldRelock).toBe(true);
  });
});
