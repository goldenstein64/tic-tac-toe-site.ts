import type { RESTGetAPICurrentUserResult as DiscordAPIUser } from "discord-api-types/v10";

import Elysia from "elysia";
import { OAuth2Tokens } from "arctic";
import discordOAuth2 from "./discord-oauth2";
import { TransactionRollbackError } from "drizzle-orm";

import { tx } from "../db";
import {
  insertUser,
  insertDiscordUser,
  selectDiscordUserById,
  updateDiscordUser,
} from "../db/queries";
import jwtAuth, {
  ACCESS_MAX_AGE,
  REFRESH_MAX_AGE,
  ACCESS_COOKIE_OPTS,
  REFRESH_COOKIE_OPTS,
} from "./jwt-auth";

declare module "bun" {
  interface Env {
    DISCORD_CLIENT_ID: string;
    DISCORD_CLIENT_SECRET: string;
    DISCORD_REDIRECT_URL: string;
  }
}

function addDiscordUser(userInfo: DiscordAPIUser, tokens: OAuth2Tokens) {
  const discordId = userInfo.id;
  const accessToken = tokens.accessToken();
  const refreshToken = tokens.refreshToken();
  const expiresAt = new Date(Date.now() + tokens.accessTokenExpiresInSeconds());

  const { userId, refreshKey } = insertUser.get({
    username: userInfo.global_name ?? userInfo.username,
  })!;

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
    .use(jwtAuth)
    .use(discordOAuth2())
    /** redirects the user to the Discord auth page */
    .get("/login/discord", ({ discord }) =>
      discord.redirect(["identify", "email"])
    )
    .get(
      "/login/discord/callback",
      async ({
        discord,
        jwtAccess,
        jwtRefresh,
        cookie: { access: cookieAccess, refresh: cookieRefresh },
        redirect,
      }) => {
        const tokens = await discord.authorize();
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
        const expiresAt = tokens.accessTokenExpiresAt();
        const userInfo = await discord.userInfo(accessToken);

        try {
          await tx(async () => {
            const discordId = userInfo.id;
            const user = selectDiscordUserById.get({ discordId });

            if (user) {
              // this user already exists, update their entry
              updateDiscordUser({
                discordId,
                accessToken,
                refreshToken,
                expiresAt,
              });
            }

            // this user doesn't exist yet, create a new entry
            const { userId, refreshKey } =
              user ?? addDiscordUser(userInfo, tokens);

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
        return redirect("/", 302);
      }
    );
