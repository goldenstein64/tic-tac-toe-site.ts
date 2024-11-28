import {
  UserPremiumType,
  type RESTGetAPICurrentUserResult as DiscordAPIUser,
} from "discord-api-types/v10";

import { describe, it, expect } from "bun:test";
import fetchMock from "fetch-mock";

import discordOauthPlugin from "./discord-oauth";
import { db } from "../db";
import { DiscordUser } from "../db/schema";
import { eq } from "drizzle-orm";

const DAYS = 60 * 60 * 24;

fetchMock
  .mockGlobal()
  .route(
    "https://discord.com/api/oauth2/token",
    {
      access_token: "ACCESS_TOKEN",
      token_type: "Bearer",
      expires_in: 7 * DAYS,
      refresh_token: "REFRESH_TOKEN",
      scope: "identify email",
    },
    { method: "POST" }
  )
  .route(
    "https://discord.com/api/v10/users/@me",
    {
      id: "DISCORD_USER_ID",
      username: "DiscordDebugUser",
      discriminator: "DiscordDiscriminator",
      global_name: "DiscordGlobalDebugUser",
      avatar: "DiscordAvatar",
      bot: false,
      system: false,
      mfa_enabled: true,
      banner: "DiscordBanner",
      accent_color: 0xffffff, // white
      locale: "en-us",
      verified: true,
      email: "user@debug.com",
      flags: undefined,
      premium_type: UserPremiumType.None,
      public_flags: undefined,
      avatar_decoration: undefined,
      avatar_decoration_data: null,
    } as DiscordAPIUser,
    { method: "GET" }
  );

const discordOauth = discordOauthPlugin();

describe("discord-oauth", () => {
  it("redirects on GET /login/discord", async () => {
    const request = new Request("http://localhost/login/discord");
    const response = await discordOauth.handle(request);
    expect(response.status).toBe(302); // Found

    const location = response.headers.get("Location")!;
    const locationURL = new URL(location as string);
    expect(locationURL.hostname).toEqual("discord.com");
    expect(locationURL.pathname).toEqual("/oauth2/authorize");
    expect(locationURL.searchParams.get("response_type")).toEqual("code");
    expect(locationURL.searchParams.get("client_id")).toEqual(
      Bun.env.DISCORD_CLIENT_ID
    );
    expect(locationURL.searchParams.get("redirect_uri")).toEqual(
      Bun.env.DISCORD_REDIRECT_URL
    );
  });

  it("redirects and sets cookies on GET /login/discord/callback", async () => {
    const requestURL = new URL("http://localhost/login/discord/callback");
    requestURL.searchParams.append("code", "1234567890");
    const request = new Request(requestURL);
    const response = await discordOauth.handle(request);
    expect(response.status).toBe(302); // Found

    const location = response.headers.get("Location")!;
    expect(location).toEqual("/");
    const discordUser = db
      .select()
      .from(DiscordUser)
      .where(eq(DiscordUser.discordId, "DISCORD_USER_ID"))
      .get();

    expect(discordUser).toMatchObject({
      discordId: "DISCORD_USER_ID",
      accessToken: "ACCESS_TOKEN",
      refreshToken: "REFRESH_TOKEN",
    });
  });
});
