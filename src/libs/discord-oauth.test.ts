import type { RESTGetAPICurrentUserResult as DiscordAPIUser } from "discord-api-types/v10";

import { describe, it, expect } from "bun:test";
import fetchMock from "fetch-mock";
import { parse as parseCookie } from "cookie";
import { eq } from "drizzle-orm";
import { UserPremiumType } from "discord-api-types/v10";

import discordOauthPlugin from "./discord-oauth";
import { db } from "../db";
import { DiscordUser } from "../db/schema";
import { ACCESS_MAX_AGE, REFRESH_MAX_AGE } from "./jwt-auth";
import { verifyAccess, verifyRefresh } from "#/test/util";

const DAYS = 60 * 60 * 24;

fetchMock
  .mockGlobal()
  .post("https://discord.com/api/oauth2/token", {
    access_token: "ACCESS_TOKEN",
    token_type: "Bearer",
    expires_in: 7 * DAYS,
    refresh_token: "REFRESH_TOKEN",
    scope: "identify email",
  })
  .get("https://discord.com/api/v10/users/@me", {
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
  } as DiscordAPIUser);

const discordOauth = discordOauthPlugin();

describe("discord-oauth", () => {
  it("redirects on GET /login/discord", async () => {
    const request = new Request("http://localhost/login/discord");
    const response = await discordOauth.handle(request);
    expect(response.status).toBe(302); // Found

    const location = response.headers.get("Location")!;
    if (!location) return expect().fail("'Location' header was absent!");
    const locationURL = new URL(location);
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

  const STATE_REGEX = /^state=(.*?);/;

  it("redirects and sets cookies on GET /login/discord/callback", async () => {
    const setCookieArray = await (async () => {
      const request = new Request("http://localhost/login/discord");
      const response = await discordOauth.handle(request);
      expect(response.status, await response.text()).toBe(302);
      return response.headers.getSetCookie();
    })();
    expect(setCookieArray.length).toBeGreaterThan(0);

    const stateCookie = setCookieArray.find((pred) => STATE_REGEX.test(pred));
    if (!stateCookie) return expect().fail("state not found!");
    const state = stateCookie.match(STATE_REGEX)![1];

    const response = await (() => {
      const requestURL = new URL("http://localhost/login/discord/callback");
      requestURL.searchParams.append("code", "1234567890");
      requestURL.searchParams.append("state", state);
      const request = new Request(requestURL, {
        headers: new Headers({
          cookie: setCookieArray.join("; "),
        }),
      });
      return discordOauth.handle(request);
    })();
    expect(response.status, await response.text()).toBe(302); // Found

    const location = response.headers.get("Location")!;
    expect(location).toEqual("/");

    const discordUser = db
      .select()
      .from(DiscordUser)
      .where(eq(DiscordUser.discordId, "DISCORD_USER_ID"))
      .get();

    if (!discordUser) return expect().fail("discord user was absent!");

    expect(discordUser).toMatchObject({
      discordId: "DISCORD_USER_ID",
      accessToken: "ACCESS_TOKEN",
      refreshToken: "REFRESH_TOKEN",
    });

    const cookies = response.headers
      .getAll("Set-Cookie")
      [Symbol.iterator]()
      .map((value) => parseCookie(value));

    for (const cookie of cookies) {
      const accessValue = cookie["access"];
      if (accessValue) {
        expect(parseFloat(cookie["Max-Age"]!)).toBe(ACCESS_MAX_AGE);

        const extracted = await verifyAccess(accessValue);
        expect(extracted.payload["userId"]).toEqual(discordUser.userId);
      }

      const refreshValue = cookie["refresh"];
      if (refreshValue) {
        expect(parseFloat(cookie["Max-Age"]!)).toBe(REFRESH_MAX_AGE);
        const extracted = await verifyRefresh(refreshValue);
        expect(extracted.payload["userId"]).toEqual(discordUser.userId);
      }
    }
  });
});
