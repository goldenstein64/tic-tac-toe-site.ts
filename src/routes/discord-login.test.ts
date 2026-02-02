import type { RESTGetAPICurrentUserResult } from "discord-api-types/v10";

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { parse as parseCookie } from "cookie";
import { eq } from "drizzle-orm";
import {
  NameplatePalette,
  UserFlags,
  UserPremiumType,
} from "discord-api-types/v10";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import discordOauthPlugin from "./discord-login";
import { db } from "../db";
import { DiscordUser } from "../db/schema";
import { ACCESS_MAX_AGE, REFRESH_MAX_AGE } from "../auth/jwt-auth";
import { verifyAccess, verifyRefresh } from "#/test/jwts";

const DAYS = 60 * 60 * 24;

// source: https://discord.com/developers/docs/resources/user#user-object-example-user
const NELLY: RESTGetAPICurrentUserResult = {
  id: "80351110224678912",
  username: "Nelly",
  global_name: null,
  discriminator: "1337",
  avatar: "8342729096ea3675442027381ff50dfe",
  verified: true,
  email: "nelly@discord.com",
  flags: UserFlags.HypeSquadOnlineHouse1,
  banner: "06c16474723fe537c283b8efa61a30c8",
  accent_color: 16711680,
  premium_type: UserPremiumType.NitroClassic,
  public_flags: UserFlags.HypeSquadOnlineHouse1,
  avatar_decoration_data: {
    sku_id: "1144058844004233369",
    asset: "a_fed43ab12698df65902ba06727e20c0e",
  },
  collectibles: {
    nameplate: {
      sku_id: "2247558840304243311",
      asset: "nameplates/nameplates/twilight/",
      label: "",
      palette: NameplatePalette.Cobalt,
    },
  },
  primary_guild: {
    identity_guild_id: "1234647491267808778",
    identity_enabled: true,
    tag: "DISC",
    badge: "7d1734ae5a615e82bc7a4033b98fade8",
  },
};

const server = setupServer(
  http.get("https://discord.com/api/v10/users/@me", () =>
    HttpResponse.json(NELLY),
  ),
  http.post("https://discord.com/api/oauth2/token", () => {
    return HttpResponse.json({
      access_token: "ACCESS_TOKEN",
      token_type: "Bearer",
      expires_in: 7 * DAYS,
      refresh_token: "REFRESH_TOKEN",
      scope: "identify email",
    });
  }),
);

beforeAll(() => server.listen());
beforeEach(() => server.resetHandlers());
afterAll(() => server.close());

const discordOauth = discordOauthPlugin();

describe("/login/discord", async () => {
  it("redirects on GET", async () => {
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
      Bun.env.DISCORD_CLIENT_ID,
    );
    expect(locationURL.searchParams.get("redirect_uri")).toEqual(
      Bun.env.DISCORD_REDIRECT_URL,
    );
  });
});

describe("/login/discord/callback", async () => {
  it("redirects and sets cookies on GET", async () => {
    const setCookieArray = await (async () => {
      const request = new Request("http://localhost/login/discord");
      const response: Response = await discordOauth.handle(request);
      expect(response.status, await response.text()).toBe(302);
      return response.headers.getSetCookie();
    })().then((a) => a.map((s) => new Bun.Cookie(s)));
    expect(setCookieArray.length).toBeGreaterThan(0);

    const stateCookie = setCookieArray.find((c) => c.name === "state");
    if (!stateCookie) expect.unreachable("state not found!");
    const state = stateCookie.value;

    const response: Response = await (() => {
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
      .where(eq(DiscordUser.discordId, NELLY.id))
      .get();

    expect(discordUser).toMatchObject({
      discordId: NELLY.id,
      accessToken: "ACCESS_TOKEN",
      refreshToken: "REFRESH_TOKEN",
    });
    if (!discordUser) expect.unreachable();

    const cookies = response.headers
      .getAll("Set-Cookie")
      .values()
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
