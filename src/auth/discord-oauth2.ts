import * as arctic from "arctic";
import { ElysiaCookie } from "elysia/dist/cookies";
import { Elysia } from "elysia";
import type { RESTGetAPICurrentUserResult } from "discord-api-types/v10";

const MINUTES = 60;

const provider = new arctic.Discord(
  Bun.env.DISCORD_CLIENT_ID,
  Bun.env.DISCORD_CLIENT_SECRET,
  Bun.env.DISCORD_REDIRECT_URL
);

const cookieDefaults: Partial<ElysiaCookie> = {
  secure: true,
  sameSite: "lax",
  path: "/",
  httpOnly: true,
  maxAge: 30 * MINUTES,
};

async function userInfo(
  accessToken: string
): Promise<RESTGetAPICurrentUserResult> {
  const response = await fetch("https://discord.com/api/v10/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  return await response.json();
}

export default function discordOAuth2() {
  return new Elysia({ name: "arctic-discord-oauth2-wrapper" })
    .error("OAUTH2_REQUEST_ERROR", arctic.OAuth2RequestError)
    .derive({ as: "scoped" }, ({ cookie, query, redirect }) => {
      return {
        discord: {
          userInfo,
          createURL(scopes: string[]): URL {
            const state = arctic.generateState();
            cookie["state"].set({
              value: state,
              ...cookieDefaults,
            });
            const codeVerifier = arctic.generateCodeVerifier();
            cookie["codeVerifier"].set({
              value: codeVerifier,
              ...cookieDefaults,
            });
            return provider.createAuthorizationURL(state, codeVerifier, scopes);
          },
          redirect(scopes: string[]): Response {
            const url = this.createURL(scopes);
            return redirect(url.href);
          },
          authorize(): Promise<arctic.OAuth2Tokens> {
            if (cookie["state"].value !== query["state"])
              throw Error("state mismatch");

            cookie["state"].remove();
            const codeVerifier = cookie["codeVerifier"].value as string | null;
            if (!codeVerifier)
              throw new Error(
                `Bug with ${String(provider)} and codeVerifier. Please open issue`
              );

            cookie["codeVerifier"].remove();
            return provider.validateAuthorizationCode(
              query["code"],
              codeVerifier
            );
          },
        },
      };
    });
}
