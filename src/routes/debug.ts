import Elysia, { t } from "elysia";
import swagger from "@elysiajs/swagger";
import { eq } from "drizzle-orm";

import jwtAuth, {
  ACCESS_COOKIE_OPTS,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE_OPTS,
  REFRESH_MAX_AGE,
} from "../auth/jwt-auth";
import { db } from "../db";
import { User } from "../db/schema";

export default async () =>
  Bun.env.NODE_ENV !== "development" ?
    new Elysia({ prefix: "/debug", name: "Debug" })
  : new Elysia({ prefix: "/debug", name: "Debug" })
      .use(await swagger({ path: "/debug/swagger" }))
      .use(jwtAuth())
      .post(
        "/user",
        async ({
          cookie: { access: cookieAccess, refresh: cookieRefresh },
          body: { usernameQuery },
          jwtAccess,
          jwtRefresh,
        }) => {
          const { userId, refreshKey } =
            db
              .select({ userId: User.id, refreshKey: User.refreshKey })
              .from(User)
              .where(eq(User.username, usernameQuery))
              .get() ??
            db
              .insert(User)
              .values({ username: usernameQuery })
              .returning({ userId: User.id, refreshKey: User.refreshKey })
              .get()!;

          cookieAccess.set({
            value: await jwtAccess.sign({
              userId,
              exp: Date.now() + ACCESS_MAX_AGE,
            }),
            ...ACCESS_COOKIE_OPTS,
          });

          cookieRefresh.set({
            value: await jwtRefresh.sign({
              userId,
              refreshKey,
              exp: Date.now() + REFRESH_MAX_AGE,
            }),
            ...REFRESH_COOKIE_OPTS,
          });
        },
        { body: t.Object({ usernameQuery: t.String() }) }
      );
