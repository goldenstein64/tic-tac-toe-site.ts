import html, { Html } from "@elysiajs/html";
import { Elysia, t } from "elysia";
import { eq, sql, notExists } from "drizzle-orm";

import { User } from "../db/schema";
import { UNIX_EPOCH } from "../db/constants";
import { db } from "../db";
import { intString } from "../types";

const ALPHANUMERIC = /\w+/;
const DAY_LENGTH = 86_400;
const USER_AGE = sql<number>`(${UNIX_EPOCH} - ${User.createdAt})`;

const upsertUser = async (args: { username: string; id?: number }) => {
  const { username, id } = args;
  const result = await db
    .insert(User)
    .values({ username, id, refreshKey: 1 })
    .onConflictDoUpdate({
      // someone with this user id exists
      // just update it with a new username (if it's not taken already)
      target: User.id,
      targetWhere: notExists(
        db.select().from(User).where(eq(User.username, username))
      ),

      set: { username, createdAt: UNIX_EPOCH },

      // if the creation time is older than a unix epoch, we would technically
      // be replacing an existing user, I think
    })
    .onConflictDoNothing()
    .returning({ id: User.id });

  if (result.length === 0) {
    return undefined;
  } else if (result.length === 1) {
    return result[0].id;
  } else {
    throw new Error("upsertUser updated more than one user!");
  }
};

const selectUsernameByIdSql = db
  .select({ username: User.username })
  .from(User)
  .where(eq(User.id, sql.placeholder("id")))
  .prepare();
const selectUsernameById = async (args: { id: number }) => {
  const result = await selectUsernameByIdSql.execute(args);
  if (result.length === 0) {
    return undefined;
  } else if (result.length === 1) {
    return result[0].username;
  } else {
    throw new Error("selected more than one user from an id!");
  }
};

export default new Elysia({ prefix: "/api" })
  .use(html())
  .get(
    "/username",
    async ({ cookie: { userId: userIdCookie } }) => {
      const userId = userIdCookie.value;
      if (userId !== undefined) {
        const username = await selectUsernameById({ id: userId });
        if (username !== undefined) {
          return { success: true, username };
        }
      }

      return { success: false };
    },
    {
      response: t.Union([
        t.Object({
          success: t.Literal(true),
          username: t.String(),
        }),
        t.Object({ success: t.Literal(false) }),
      ]),
      cookie: t.Object({ userId: t.Optional(intString) }),
    }
  )
  .put(
    "/username",
    async ({ body: { username }, cookie: { userId: userIdCookie } }) => {
      let message: string | undefined = undefined;
      if (username.length < 1) {
        message = "username must have at least 1 character";
      } else if (username.length > 32) {
        message = "username must have at most 32 characters";
      } else if (!ALPHANUMERIC.test(username)) {
        message = "username must be entirely alphanumeric";
      }

      if (message !== undefined) {
        return { success: false, message };
      }

      // get the person's stored user id
      const userId: number | undefined = userIdCookie.value;

      // if it doesn't exist, give them a new user id
      // otherwise, update the existing one
      // both possibilities are handled by upsertUser
      const newUserId = await upsertUser({ username, id: userId });
      if (newUserId === undefined) {
        // a user id couldn't be added, so the username change failed
        return { success: false, message: "username is taken" };
      }

      userIdCookie.value = newUserId;
      userIdCookie.maxAge = DAY_LENGTH;

      return { success: true };
    },
    {
      body: t.Object({ username: t.String() }),
      type: "application/x-www-form-urlencoded",
      response: t.Union([
        t.Object({ success: t.Literal(true) }),
        t.Object({ success: t.Literal(false), message: t.String() }),
      ]),
      cookie: t.Object({ userId: t.Optional(intString) }),
    }
  );
