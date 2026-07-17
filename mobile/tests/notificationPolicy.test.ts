import { describe, expect, it } from "vitest";

import { isCriticalAlert, safeNotificationRoute } from "../app/lib/notificationPolicy";

describe("notification policy", () => {
  it("uses structured severity instead of guessing from alert titles", () => {
    expect(isCriticalAlert({ severity: "critical" })).toBe(true);
    expect(isCriticalAlert({ severity: "low" })).toBe(false);
  });

  it("keeps notification navigation inside approved app routes", () => {
    expect(safeNotificationRoute("/result?id=scan-1")).toBe("/result?id=scan-1");
    expect(safeNotificationRoute("https://evil.example", "scan-1")).toBe("/result?id=scan-1");
    expect(safeNotificationRoute("//evil.example", null)).toBe("/notifications");
    expect(safeNotificationRoute("/developer", null)).toBe("/notifications");
  });
});
