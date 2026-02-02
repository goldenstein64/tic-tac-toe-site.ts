import { it, expect, describe } from "bun:test";
import Elysia from "elysia";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { User } from "../db/schema";
import jwtAuth from "./jwt-auth";
import { signAccess } from "#/test/jwts";

const DebugUser = 4;

const debugUser = (() => {
  const user = db.select().from(User).where(eq(User.id, DebugUser)).get()!;
  return { ...user, createdAt: user.createdAt.toISOString() };
})();

const testApp = new Elysia({ name: "test-jwt-auth" })
  .use(jwtAuth())
  .get("/user", ({ user }) => Response.json(user));

describe("jwt-auth", () => {
  it("resolves user to null if cookie is empty", async () => {
    const request = new Request("http://localhost/user");
    const response = await testApp.handle(request);

    expect(await response.json()).toBeNull();
  });

  it("resolves user to null if cookie is invalid", async () => {
    const access = new Bun.Cookie("access", await signAccess({ userId: -1 }));
    const request = new Request("http://localhost/user");
    request.headers.append("Cookie", String(access));
    const response = await testApp.handle(request);

    expect(await response.json()).toBeNull();
  });

  it("resolves user to an object if cookie is valid", async () => {
    const access = new Bun.Cookie("access", await signAccess({ userId: 4 }));
    const request = new Request("http://localhost/user");
    request.headers.append("Cookie", String(access));
    const response = await testApp.handle(request);

    expect(await response.json()).toEqual(debugUser);
  });
});
