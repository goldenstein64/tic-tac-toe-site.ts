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

export default new Elysia({ prefix: "/api" }).post(
  "/user",
  async ({ body: { username }, cookie: { userId: userIdCookie }, set }) => {
    const users = await selectUser.execute({ username });
    userIdCookie.maxAge = 86400;
    userIdCookie.sameSite = "strict";
    if (users.length > 0) {
      // a user exists with this username, tell them they can't use it
      return { success: false };
    }
  },
  {
    body: t.Object({
      username: t.String({ maxLength: 32 }),
    }),
  }
);
