import Elysia, { error, t } from "elysia";
import swagger from "@elysiajs/swagger";
import { eq } from "drizzle-orm";

import jwtAuth, {
  ACCESS_COOKIE_OPTS,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE_OPTS,
  REFRESH_MAX_AGE,
} from "../libs/jwt-auth";
import { db } from "../db";
import { User } from "../db/schema";

export default () =>
  Bun.env.NODE_ENV !== "development"
    ? new Elysia({ prefix: "/debug", name: "Debug" })
    : new Elysia({ prefix: "/debug", name: "Debug" })
        .use(swagger({ path: "/debug/swagger" }))
        .use(jwtAuth())
        .post(
          "/user",
          async ({
            cookie: { access: cookieAccess, refresh: cookieRefresh },
            body: { username },
            jwtAccess,
            jwtRefresh,
          }) => {
            const access = await jwtAccess.verify(cookieAccess.value);
            if (access) return error("No Content");

            const refresh = await jwtRefresh.verify(cookieRefresh.value);
            if (refresh) {
              const { refreshKey } = db
                .select({ refreshKey: User.refreshKey })
                .from(User)
                .where(eq(User.id, refresh.userId))
                .get()!;

              if (refreshKey === refresh.refreshKey) {
                return error("No Content");
              }
            }

            const { userId } = db
              .insert(User)
              .values({ username, refreshKey: 1 })
              .returning({ userId: User.id })
              .get()!;

            cookieAccess.set({
              value: jwtAccess.sign({
                userId,
                exp: Date.now() + ACCESS_MAX_AGE,
              }),
              ...ACCESS_COOKIE_OPTS,
            });

            cookieRefresh.set({
              value: jwtRefresh.sign({
                userId,
                refreshKey: 1,
                exp: Date.now() + REFRESH_MAX_AGE,
              }),
              ...REFRESH_COOKIE_OPTS,
            });
          },
          {
            body: t.Object({ username: t.String() }),
          }
        );
