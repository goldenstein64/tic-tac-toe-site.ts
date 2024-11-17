import jwt from "@elysiajs/jwt";
import Elysia, { t } from "elysia";
import { db } from "../db";
import { User } from "../db/schema";
import { eq, sql, InferSelectModel } from "drizzle-orm";

declare module "bun" {
  interface Env {
    JWT_ACCESS_SECRET: string;
    JWT_REFRESH_SECRET: string;
  }
}

const ACCESS_MAX_AGE = 15 * 60; // 15 minutes
const accessCookieOpts = { maxAge: ACCESS_MAX_AGE, httpOnly: true } as const;

const selectUserByIdSql = db
  .select()
  .from(User)
  .where(eq(User.id, sql.placeholder("userId")))
  .prepare();
type User = InferSelectModel<typeof User>;
async function selectUserById(args: { userId: number }) {
  const result = await selectUserByIdSql.execute(args);
  if (result.length > 1) {
    throw new Error("selected more than one user!");
  }

  return result.length === 1 ? result[0] : undefined;
}

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
        cookie: { cookieAccess, cookieRefresh },
      }): Promise<{ user: InferSelectModel<typeof User> | null }> => {
        // check whether they're already logged in
        const access = await jwtAccess.verify(cookieAccess.value);
        if (access) {
          const user = await selectUserById({ userId: access.userId });
          return user ? { user } : { user: null };
        }

        // otherwise, try to refresh the token
        const refresh = await jwtRefresh.verify(cookieRefresh.value);
        if (!refresh) return { user: null };

        const { userId, refreshKey } = refresh;

        const user = await selectUserById({ userId });

        if (!user || refreshKey !== user.refreshKey) {
          // user wasn't found or their refresh key didn't match :(
          return { user: null };
        }

        // by this point, we can refresh the user's access token
        cookieAccess.set({
          value: jwtAccess.sign({
            userId,
            exp: Math.floor(Date.now() / 1000) + ACCESS_MAX_AGE,
          }),
          ...accessCookieOpts,
        });

        // now we can expose them to the rest of the API
        return { user };
      }
    );
