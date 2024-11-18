import { db } from "./src/db";
import { DiscordUser } from "./src/db/schema";
import { Discord } from "elysia-oauth2";

import { eq, gt } from "drizzle-orm";

const discord = new Discord(
  Bun.env.DISCORD_CLIENT_ID,
  Bun.env.DISCORD_CLIENT_SECRET,
  Bun.env.DISCORD_REDIRECT_URL
);

// according to the Discord API, the access token expires in 7 days
// we could probably refresh the token on the day before on server cleanup
// (given the server is up at that time lol!)
// SELECT refreshToken FROM User
//   WHERE expiresAt > unixepoch() - 1 * 24 * 60 * 60;

const DAYS = 24 * 60 * 60;

const refreshTokens = await db
  .select({
    refreshToken: DiscordUser.refreshToken,
    discordId: DiscordUser.discordId,
  })
  .from(DiscordUser)
  .where(gt(DiscordUser.expiresAt, new Date(Date.now() - 1.5 * DAYS)));

const refreshResults = await Promise.allSettled(
  refreshTokens.map(async ({ refreshToken, discordId }) => {
    try {
      const tokens = await discord.refreshAccessToken(refreshToken);
      await db
        .update(DiscordUser)
        .set({
          accessToken: tokens.accessToken(),
          refreshToken: tokens.refreshToken(),
          expiresAt: new Date(
            Date.now() + tokens.accessTokenExpiresInSeconds()
          ),
        })
        .where(eq(DiscordUser.discordId, discordId));
    } catch (error) {
      throw new Error(`${discordId} could not be refreshed!`, { cause: error });
    }
  })
);

const rejectedRefreshes = refreshResults.filter(
  (result): result is PromiseRejectedResult => result.status === "rejected"
);

if (rejectedRefreshes.length > 0) {
  console.error(
    `${rejectedRefreshes.length} ${
      refreshResults.length === 1 ? "token" : "tokens"
    } couldn't be refreshed!\nuser ids:\n${rejectedRefreshes.map(
      (result) => result.reason
    )}`
  );
}
