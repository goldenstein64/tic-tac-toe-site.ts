import type { RESTGetAPICurrentUserResult as DiscordCurrentUser } from "discord-api-types/v10";

import Elysia, { redirect } from "elysia";
import { oauth2, Discord } from "elysia-oauth2";
import { DiscordUser, User } from "../db/schema";
import { db, tx } from "../db";
import { eq, SQL, sql, TransactionRollbackError } from "drizzle-orm";

type SQLProps<T extends object> = {
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

  async userInfo(accessToken: string): Promise<DiscordCurrentUser> {
    const response = await fetch("https://discord.com/api/v10/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    return await response.json();
  },
} as const;

const selectDiscordUserByIdSql = db
  .select({ userId: DiscordUser.userId })
  .from(DiscordUser)
  .where(eq(DiscordUser.discordId, sql.placeholder("discordId")))
  .prepare();
const selectDiscordUserById = async (args: SQLProps<{ discordId: string }>) => {
  const users = await selectDiscordUserByIdSql.execute(args);
  if (users.length > 1) {
    throw new Error("selected more than one user by discord id!");
  }

  return users.length === 1 ? users[0].userId : undefined;
};

const insertUserSql = db
  .insert(User)
  .values({ username: sql.placeholder("username"), refreshKey: 1 })
  .returning({ userId: User.id })
  .prepare();
const insertUser = async (args: SQLProps<{ username: string }>) => {
  const users = await insertUserSql.execute(args);
  if (users.length > 1) {
    throw new Error("inserted more than one user!");
  }

  return users.length === 1 ? users[0].userId : undefined;
};

const insertDiscordUserSql = db
  .insert(DiscordUser)
  .values({
    discordId: sql.placeholder("discordId"),
    userId: sql.placeholder("userId"),
    accessToken: sql.placeholder("accessToken"),
    refreshToken: sql.placeholder("refreshToken"),
    expiresAt: sql.placeholder("expiresAt"),
  })
  .prepare();
const insertDiscordUser = async (
  args: SQLProps<{
    discordId: string;
    userId: number;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }>
) => {
  await insertDiscordUserSql.execute(args);
};

const updateDiscordUser = async ({
  discordId,
  accessToken,
  refreshToken,
  expiresAt,
}: SQLProps<{
  discordId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}>) => {
  await db
    .update(DiscordUser)
    .set({
      accessToken,
      refreshToken,
      expiresAt,
    })
    .where(eq(DiscordUser.discordId, discordId));
};

/**
 * does all the external authorization stuff needed to get the user's account
 */
export default () =>
  new Elysia()
    .use(
      oauth2({
        Discord: [
          Bun.env.DISCORD_CLIENT_ID,
          Bun.env.DISCORD_CLIENT_SECRET,
          Bun.env.DISCORD_REDIRECT_URL,
        ],
      })
    )
    .get("/login/discord", ({ oauth2 }) =>
      oauth2.redirect("Discord", ["identify", "email"])
    )
    .get("/login/discord/callback", async ({ oauth2 }) => {
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
        await tx.transaction(async () => {
          const discordId = userInfo.id;
          const discordUserId = await selectDiscordUserById({ discordId });

          if (discordUserId !== undefined) {
            // this user exists, update their entry
            await updateDiscordUser({
              discordId,
              accessToken,
              refreshToken,
              expiresAt,
            });
          } else {
            // this user doesn't exist yet, create a new entry
            const userId = await insertUser({
              username: userInfo.global_name ?? userInfo.username,
            });

            if (userId === undefined) {
              throw new Error("exactly one user was not inserted!");
            }

            await insertDiscordUser({
              discordId,
              userId,
              accessToken,
              refreshToken,
              expiresAt,
            });
          }
        });
      } catch (err) {
        if (!(err instanceof TransactionRollbackError)) throw err;
      }

      // redirect the user back to the home page
      return redirect("/");
    })
    .decorate("discord", discord);
