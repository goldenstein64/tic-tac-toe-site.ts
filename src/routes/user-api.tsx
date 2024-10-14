import { Html, html } from "@elysiajs/html";
import { Elysia, t } from "elysia";
import { eq, sql } from "drizzle-orm";

import { User } from "../db/schema";
import { db } from "../db";

const insertUser = db
  .insert(User)
  .values({
    username: sql.placeholder("username"),
  })
  .prepare();

const selectUser = db
  .select({ id: User.id, username: User.username })
  .from(User)
  .where(eq(User.username, sql.placeholder("username")))
  .prepare();

export default new Elysia({ prefix: "/api" }).use(html()).post(
  "/user",
  async ({ body: { username }, cookie: { userId: userIdCookie } }) => {
    const users = await selectUser.execute({ username });
    userIdCookie.maxAge = 86400;
    userIdCookie.sameSite = "strict";
    if (users.length > 0) {
      // a user exists with this username, tell them they can't use it
      return (
        <div>
          <input
            hx-select="#set-username"
            hx-swap="outerHTML"
            id="set-username"
          />
          <div
            hx-select="#username-result"
            hx-swap="outerHTML"
            id="username-result"
          >
            Username is taken
          </div>
        </div>
      );
    } else {
      return (
        <div>
          <input hx-select="#set-username" id="set-username" value={username} />
        </div>
      );
    }
  },
  {
    body: t.Object({
      username: t.String({ maxLength: 32 }),
    }),
  }
);
