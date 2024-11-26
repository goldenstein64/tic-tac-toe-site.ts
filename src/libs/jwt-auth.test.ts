import { it, expect, describe } from "bun:test";
import Elysia from "elysia";
import { eq } from "drizzle-orm";

import { db } from "../db";
import jwtAuth from "./jwt-auth";
import { User } from "../db/schema";
import { getAccessCookie } from "../../test/util";

const debugUserId = 4;
const debugUser = JSON.parse(
  JSON.stringify(db.select().from(User).where(eq(User.id, debugUserId)).get()!)
);

const testApp = new Elysia({ name: "test-jwt-auth" }).use(jwtAuth()).get(
  "/user",
  ({ user }) =>
    new Response(JSON.stringify(user), {
      headers: { "Content-Type": "application/json" },
    })
);

describe("jwt-auth", () => {
  it("resolves user to null if cookie is empty", async () => {
    const response = await testApp.handle(new Request("http://localhost/user"));

    expect(await response.json()).toBeNull();
  });

  it("resolves user to null if cookie is invalid", async () => {
    const response = await testApp.handle(
      new Request("http://localhost/user", {
        headers: await getAccessCookie(-1),
      })
    );

    expect(await response.json()).toBeNull();
  });

  it("resolves user to an object if cookie is valid", async () => {
    const response = await testApp.handle(
      new Request("http://localhost/user", {
        headers: await getAccessCookie(4),
      })
    );

    expect(await response.json()).toEqual(debugUser);
  });
});
