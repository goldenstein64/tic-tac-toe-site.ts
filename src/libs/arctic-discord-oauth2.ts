import * as arctic from "arctic";
import { ElysiaCookie } from "elysia/dist/cookies";
import { Elysia } from "elysia";

type DiscordOAuth2Options = {
  provider: arctic.Discord;
  cookie?: Omit<Partial<ElysiaCookie>, "value">;
};

export default function discordOauth2({
  provider,
  cookie,
}: DiscordOAuth2Options) {
  const cookieDefaults: Partial<ElysiaCookie> = {
    secure: true,
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    maxAge: 60 * 30,
    // 30 min
    ...cookie,
  };
  return new Elysia({ name: "arctic-discord-oauth2-wrapper" })
    .error("OAUTH2_REQUEST_ERROR", arctic.OAuth2RequestError)
    .derive({ as: "scoped" }, ({ cookie, query, redirect }) => {
      return {
        oauth2: {
          createURL: (scopes: string[]): URL => {
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
            if (!cookie["codeVerifier"].value)
              throw new Error(
                `Bug with ${String(provider)} and codeVerifier. Please open issue`
              );

            cookie["codeVerifier"].remove();
            return provider.validateAuthorizationCode(
              query["code"],
              cookie["codeVerifier"].value
            );
          },
        },
      };
    });
}
