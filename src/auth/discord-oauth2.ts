import type { RESTGetAPICurrentUserResult } from "discord-api-types/v10";
import type { OAuth2Tokens } from "arctic";

import {
  Discord,
  OAuth2RequestError,
  generateState,
  generateCodeVerifier,
} from "arctic";
import { ElysiaCookie } from "elysia/dist/cookies";
import { Elysia } from "elysia";

const MINUTES = 60;

const provider = new Discord(
  Bun.env.DISCORD_CLIENT_ID,
  Bun.env.DISCORD_CLIENT_SECRET,
  Bun.env.DISCORD_REDIRECT_URL,
);

const cookieDefaults: Partial<ElysiaCookie> = {
  secure: true,
  sameSite: "lax",
  path: "/",
  httpOnly: true,
  maxAge: 30 * MINUTES,
};

export default function discordOAuth2() {
  return new Elysia({ name: "arctic-discord-oauth2-wrapper" })
    .error("OAUTH2_REQUEST_ERROR", OAuth2RequestError)
    .derive({ as: "scoped" }, ({ cookie, query, redirect }) => ({
      discord: {
        async userInfo(
          accessToken: string,
        ): Promise<RESTGetAPICurrentUserResult> {
          const response = await fetch(
            "https://discord.com/api/v10/users/@me",
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
              },
            },
          );

          return response.json();
        },
        createURL(scopes: string[]): URL {
          const state = generateState();
          cookie["state"].set({
            value: state,
            ...cookieDefaults,
          });
          const codeVerifier = generateCodeVerifier();
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
        authorize(): Promise<OAuth2Tokens> {
          // if both of these originate from the client, couldn't both of them
          // also be spoofed?
          if (cookie["state"].value !== query["state"])
            throw new Error("state mismatch");

          cookie["state"].remove();
          const codeVerifier = cookie["codeVerifier"].value as string | null;
          if (!codeVerifier)
            throw new Error(
              `Bug with ${provider} and codeVerifier. Please open issue`,
            );

          cookie["codeVerifier"].remove();
          return provider.validateAuthorizationCode(
            query["code"],
            codeVerifier,
          );
        },
      },
    }));
}
