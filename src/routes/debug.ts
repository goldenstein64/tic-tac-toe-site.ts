import Elysia, { t } from "elysia";
import swagger from "@elysiajs/swagger";

import jwtAuth, {
  ACCESS_COOKIE_OPTS,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE_OPTS,
  REFRESH_MAX_AGE,
} from "../libs/jwt-auth";
import { db } from "../db";
import { User } from "../db/schema";
import { eq } from "drizzle-orm";

export default () =>
  Bun.env.NODE_ENV !== "development" ?
    new Elysia({ prefix: "/debug", name: "Debug" })
  : new Elysia({ prefix: "/debug", name: "Debug" })
      .use(swagger({ path: "/debug/swagger" }))
      .use(jwtAuth())
      .post(
        "/user",
        async ({
          cookie: { access: cookieAccess, refresh: cookieRefresh },
          body: { usernameQuery },
          jwtAccess,
          jwtRefresh,
        }) => {
          const foundUser = db
            .select()
            .from(User)
            .where(eq(User.username, usernameQuery))
            .get();

          let userId: number;
          let refreshKey: number;
          if (foundUser) {
            userId = foundUser.id;
            refreshKey = foundUser.refreshKey;
          } else {
            const createdUser = db
              .insert(User)
              .values({ username: usernameQuery, refreshKey: 1 })
              .returning({ id: User.id })
              .get()!;
            userId = createdUser.id;
            refreshKey = 1;
          }

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
        {
          body: t.Object({ usernameQuery: t.String() }),
        }
      );
