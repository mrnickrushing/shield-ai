import { beforeEach, describe, expect, it } from "vitest";

import { api, clearToken, hydrateToken, setToken } from "./api";

const values = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
  clear: () => values.clear(),
};

Object.defineProperty(globalThis, "window", { value: { localStorage }, configurable: true });

describe("admin credential storage", () => {
  beforeEach(() => {
    clearToken();
    values.clear();
  });

  it("keeps the bearer token in process memory and removes legacy persistence", () => {
    values.set("shield_admin_token", "legacy-token");
    setToken("session-token");

    expect(hydrateToken()).toBe("session-token");
    expect(localStorage.getItem("shield_admin_token")).toBeNull();
    expect(api.defaults.headers.common.Authorization).toBe("Bearer session-token");
  });

  it("clears both memory and authorization headers", () => {
    setToken("session-token");
    clearToken();

    expect(hydrateToken()).toBeNull();
    expect(api.defaults.headers.common.Authorization).toBeUndefined();
  });
});
