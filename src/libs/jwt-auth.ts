import jwt from "@elysiajs/jwt";
import Elysia, { t } from "elysia";
import { eq, sql, InferSelectModel, and } from "drizzle-orm";

import { db, typePrepared } from "../db";
import { User } from "../db/schema";

declare module "bun" {
  interface Env {
    JWT_ACCESS_SECRET: string;
    JWT_REFRESH_SECRET: string;
  }
}

const MINUTES = 60;
const DAYS = 60 * 60 * 24;

export const ACCESS_MAX_AGE = 15 * MINUTES;
export const REFRESH_MAX_AGE = 30 * DAYS;
export const ACCESS_COOKIE_OPTS = {
  maxAge: ACCESS_MAX_AGE,
  httpOnly: true,
  sameSite: "lax",
} as const;
export const REFRESH_COOKIE_OPTS = {
  maxAge: REFRESH_MAX_AGE,
  httpOnly: true,
  sameSite: "lax",
} as const;

const _placeholders: any = undefined;

const selectUserById = typePrepared(
  db
    .select()
    .from(User)
    .where(eq(User.id, sql.placeholder("userId")))
    .prepare(),
  _placeholders as { userId: number }
);

const selectUserByIdRefreshKey = typePrepared(
  db
    .select()
    .from(User)
    .where(
      and(
        eq(User.id, sql.placeholder("userId")),
        eq(User.refreshKey, sql.placeholder("refreshKey"))
      )
    )
    .prepare(),
  _placeholders as { userId: number; refreshKey: number }
);

export default () =>
  new Elysia({ name: "JWTAuth" })
    .use(
      jwt({
        name: "jwtAccess",
        secret: Bun.env.JWT_ACCESS_SECRET,
        schema: t.Object({ userId: t.Number() }),
      })
    )
    .use(
      jwt({
        name: "jwtRefresh",
        secret: Bun.env.JWT_REFRESH_SECRET,
        schema: t.Object({ userId: t.Number(), refreshKey: t.Number() }),
      })
    )
    .resolve(
      { as: "scoped" },
      async ({
        jwtAccess,
        jwtRefresh,
        cookie: { access: cookieAccess, refresh: cookieRefresh },
      }): Promise<{ user: InferSelectModel<typeof User> | null }> => {
        // check whether they're already logged in
        const access = await jwtAccess.verify(cookieAccess.value);
        if (access) {
          const user = selectUserById.get({ userId: access.userId });
          return { user: user ?? null };
        }

        // otherwise, try to refresh the token
        const refresh = await jwtRefresh.verify(cookieRefresh.value);
        if (!refresh) return { user: null };

        const { userId, refreshKey } = refresh;
        const user = selectUserByIdRefreshKey.get({ userId, refreshKey });
        if (!user) return { user: null };

        cookieAccess.set({
          value: await jwtAccess.sign({
            userId,
            exp: Math.floor(Date.now() / 1000) + ACCESS_MAX_AGE,
          }),
          ...ACCESS_COOKIE_OPTS,
        });

        return { user };
      }
    );
