import { it, expect, describe } from "bun:test";
import Elysia from "elysia";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { User } from "../db/schema";
import jwtAuth from "./jwt-auth";
import { signAccess } from "#/test/jwts";

const debugUserId = 4;
const debugUser = JSON.parse(
  JSON.stringify(db.select().from(User).where(eq(User.id, debugUserId)).get()!),
);

const testApp = new Elysia({ name: "test-jwt-auth" }).use(jwtAuth()).get(
  "/user",
  ({ user }) =>
    new Response(JSON.stringify(user), {
      headers: { "Content-Type": "application/json" },
    }),
);

describe("jwt-auth", () => {
  it("resolves user to null if cookie is empty", async () => {
    const response = await testApp.handle(new Request("http://localhost/user"));

    expect(await response.json()).toBeNull();
  });

  it("resolves user to null if cookie is invalid", async () => {
    const request = new Request("http://localhost/user", {
      headers: { Cookie: `access=${await signAccess({ userId: -1 })}` },
    });

    const response = await testApp.handle(request);

    expect(await response.json()).toBeNull();
  });

  it("resolves user to an object if cookie is valid", async () => {
    const request = new Request("http://localhost/user", {
      headers: { Cookie: `access=${await signAccess({ userId: 4 })}` },
    });

    const response = await testApp.handle(request);

    expect(await response.json()).toEqual(debugUser);
  });
});
