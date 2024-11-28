import type { RESTGetAPICurrentUserResult as DiscordAPIUser } from "discord-api-types/v10";

import Elysia, { redirect } from "elysia";
import { oauth2, Discord, OAuth2Tokens } from "elysia-oauth2";

import jwtAuth, {
  ACCESS_MAX_AGE,
  REFRESH_MAX_AGE,
  ACCESS_COOKIE_OPTS,
  REFRESH_COOKIE_OPTS,
} from "./jwt-auth";
import { DiscordUser, User } from "../db/schema";
import { db, tx, typePrepared } from "../db";
import { eq, SQL, sql, TransactionRollbackError } from "drizzle-orm";

type SQLProps<T extends Record<string, unknown>> = {
  [K in keyof T]: T[K] | SQL<T[K]>;
};

declare module "bun" {
  interface Env {
    DISCORD_CLIENT_ID: string;
    DISCORD_CLIENT_SECRET: string;
    DISCORD_REDIRECT_URL: string;
  }
}

export const discord = {
  oauth2: new Discord(
    Bun.env.DISCORD_CLIENT_ID,
    Bun.env.DISCORD_CLIENT_SECRET,
    Bun.env.DISCORD_REDIRECT_URL
  ),

  async userInfo(accessToken: string): Promise<DiscordAPIUser> {
    const response = await fetch("https://discord.com/api/v10/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    return await response.json();
  },
} as const;

const _placeholders: any = undefined;

const selectDiscordUserById = typePrepared(
  db
    .select({ userId: DiscordUser.userId, refreshKey: User.refreshKey })
    .from(DiscordUser)
    .innerJoin(User, eq(User.id, DiscordUser.userId))
    .where(eq(DiscordUser.discordId, sql.placeholder("discordId")))
    .prepare(),
  _placeholders as SQLProps<{ discordId: string }>
);

const insertUser = typePrepared(
  db
    .insert(User)
    .values({ username: sql.placeholder("username"), refreshKey: 1 })
    .returning({ userId: User.id, refreshKey: User.refreshKey })
    .prepare(),
  _placeholders as SQLProps<{ username: string }>
);

const insertDiscordUser = typePrepared(
  db
    .insert(DiscordUser)
    .values({
      discordId: sql.placeholder("discordId"),
      userId: sql.placeholder("userId"),
      accessToken: sql.placeholder("accessToken"),
      refreshToken: sql.placeholder("refreshToken"),
      expiresAt: sql.placeholder("expiresAt"),
    })
    .prepare(),
  _placeholders as SQLProps<{
    discordId: string;
    userId: number;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }>
);

const updateDiscordUser = ({
  discordId,
  ...values
}: SQLProps<{
  discordId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}>) => {
  db.update(DiscordUser)
    .set(values)
    .where(eq(DiscordUser.discordId, discordId))
    .run();
};

async function addDiscordUser(userInfo: DiscordAPIUser, tokens: OAuth2Tokens) {
  const discordId = userInfo.id;
  const accessToken = tokens.accessToken();
  const refreshToken = tokens.refreshToken();
  const expiresAt = new Date(Date.now() + tokens.accessTokenExpiresInSeconds());

  const { userId, refreshKey } = insertUser.get({
    username: userInfo.global_name ?? userInfo.username,
  })!;

  if (userId === undefined) {
    throw new Error("exactly one user was not inserted!");
  }

  insertDiscordUser.run({
    discordId,
    userId,
    accessToken,
    refreshToken,
    expiresAt,
  });

  return { userId, refreshKey };
}

/**
 * does all the external authorization stuff needed to get the user's account
 */
export default () =>
  new Elysia()
    .decorate("discord", discord)
    .use(jwtAuth)
    .use(
      oauth2({
        Discord: [
          Bun.env.DISCORD_CLIENT_ID,
          Bun.env.DISCORD_CLIENT_SECRET,
          Bun.env.DISCORD_REDIRECT_URL,
        ],
      })
    )
    /** redirects the user to the Discord auth page */
    .get(
      "/login/discord",
      async ({ oauth2 }) =>
        await oauth2.redirect("Discord", ["identify", "email"])
    )

    .get(
      "/login/discord/callback",
      async ({
        oauth2,
        jwtAccess,
        jwtRefresh,
        cookie: { access: cookieAccess, refresh: cookieRefresh },
      }) => {
        const tokens = await oauth2.authorize("Discord");
        // the data in Discord's response can be found here:
        // https://discord.com/developers/docs/topics/oauth2#authorization-code-grant-access-token-response
        /*
        {
          "access_token": "6qrZcUqja7812RVdnEKjpzOL4CvHBFG",
          "token_type": "Bearer",
          "expires_in": 604800,
          "refresh_token": "D43f5y0ahjqew82jZ4NViEr2YafMKhue",
          "scope": "identify"
        }
      */

        // associate the access token and refresh token with this user
        const accessToken = tokens.accessToken();
        const refreshToken = tokens.refreshToken();
        const expiresAt = new Date(
          Date.now() + tokens.accessTokenExpiresInSeconds()
        );
        const userInfo = await discord.userInfo(accessToken);

        try {
          await tx(async () => {
            const discordId = userInfo.id;
            const user = selectDiscordUserById.get({ discordId });

            if (user) {
              // this user already exists, update their entry
              await updateDiscordUser({
                discordId,
                accessToken,
                refreshToken,
                expiresAt,
              });
            }

            // this user doesn't exist yet, create a new entry
            const { userId, refreshKey } =
              user ?? (await addDiscordUser(userInfo, tokens));

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
          });
        } catch (err) {
          if (!(err instanceof TransactionRollbackError)) throw err;
        }

        // redirect the user back to the home page
        return redirect("/");
      }
    );
