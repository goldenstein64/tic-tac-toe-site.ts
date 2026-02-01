import { describe, it, expect } from "bun:test";

import { signRefresh } from "#/test/jwts";
import { createTestClient } from "#/test/clients";

import sessionApi from "./session-api";

const as = createTestClient(sessionApi);

const DebugUser = 4;

describe("DELETE /api/session", () => {
  it("works", async () => {
    const refreshCookie = new Bun.Cookie(
      "refresh",
      await signRefresh({ userId: DebugUser, refreshKey: 1 }),
    );
    const response = await as(DebugUser, {
      Cookie: String(refreshCookie),
    }).delete("/session");

    const setCookie = response.headers.getSetCookie();
    expect(setCookie).toBeArrayOfSize(2);
    const setCookie1 = new Bun.Cookie(setCookie[0]);
    const setCookie2 = new Bun.Cookie(setCookie[1]);
    expect([setCookie1.name, setCookie2.name]).toStrictEqual(
      expect.arrayContaining(["access", "refresh"]),
    );
    expect(setCookie1.value).toBe("");
    expect(setCookie2.value).toBe("");
  });

  // This isn't a requirement, just an observation.
  it("does nothing when requested by a non-user", async () => {
    const response = await as(undefined).delete("/session");

    const setCookie = response.headers.getSetCookie();
    expect(setCookie).toStrictEqual([]);
  });
});
