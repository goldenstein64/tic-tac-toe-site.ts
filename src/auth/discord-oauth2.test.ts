import type { RESTGetAPICurrentUserResult } from "discord-api-types/v10";

import {
  NameplatePalette,
  UserFlags,
  UserPremiumType,
} from "discord-api-types/v10";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { http, HttpResponse } from "msw";

import { setupServer } from "msw/node";
import Elysia from "elysia";
import discordOAuth2 from "./discord-oauth2";
import { generateCodeVerifier, generateState } from "arctic";

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
} as const;

const OAUTH2_TOKEN = {
  access_token: "ACCESS_TOKEN",
  token_type: "Bearer",
  expires_in: 7 * DAYS,
  refresh_token: "REFRESH_TOKEN",
  scope: "identify email",
} as const;

const server = setupServer(
  http.get("https://discord.com/api/v10/users/@me", ({ request }) => {
    const authorization = request.headers.get("Authorization");
    expect(authorization).toBe("Bearer MY_ACCESS_TOKEN");
    return HttpResponse.json(NELLY);
  }),
  http.post("https://discord.com/api/oauth2/token", () =>
    HttpResponse.json(OAUTH2_TOKEN),
  ),
);

beforeAll(() => server.listen());
beforeEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("discordOAuth2()", () => {
  describe("userInfo", () => {
    it("works", async () => {
      const app = new Elysia()
        .use(discordOAuth2())
        .get("/user", ({ discord }) => discord.userInfo("MY_ACCESS_TOKEN"));

      const response = await app.handle(new Request("http://localhost/user"));

      expect(await response.json()).toStrictEqual(NELLY);
    });
  });

  describe("authorize()", () => {
    const app = new Elysia()
      .use(discordOAuth2())
      .get("/authorize", async ({ discord }) => {
        const tokens = await discord.authorize();
        return tokens.data;
      });

    it("works", async () => {
      const state = generateState();
      const codeVerifier = generateCodeVerifier();
      const url = new URL("/authorize", "http://localhost");
      url.searchParams.append("code", "MY_DISCORD_CODE");
      url.searchParams.append("state", state);

      const response = await app.handle(
        new Request(url, {
          headers: [
            ["Cookie", String(new Bun.Cookie("state", state))],
            ["Cookie", String(new Bun.Cookie("codeVerifier", codeVerifier))],
          ],
        }),
      );

      expect(await response.json()).toStrictEqual(OAUTH2_TOKEN);
    });
    it("errors if query and cookie states mismatch", async () => {
      const state = generateState();
      const codeVerifier = generateCodeVerifier();
      const url = new URL("/authorize", "http://localhost");
      url.searchParams.append("code", "MY_DISCORD_CODE");
      url.searchParams.append("state", state);

      const response = await app.handle(
        new Request(url, {
          headers: [
            ["Cookie", String(new Bun.Cookie("state", "WRONG_STATE"))],
            ["Cookie", String(new Bun.Cookie("codeVerifier", codeVerifier))],
          ],
        }),
      );

      expect(response.status).toBe(500);
    });
    it("errors if codeVerifier is not provided", async () => {
      const state = generateState();
      const url = new URL("/authorize", "http://localhost");
      url.searchParams.append("code", "MY_DISCORD_CODE");
      url.searchParams.append("state", state);

      const response = await app.handle(
        new Request(url, {
          headers: [
            ["Cookie", String(new Bun.Cookie("state", state))],
            // ["Cookie", String(new Bun.Cookie("codeVerifier", codeVerifier))],
          ],
        }),
      );

      expect(response.status).toBe(500);
    });
  });
});
