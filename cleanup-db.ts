import { db } from "./src/db";
import { DiscordUser } from "./src/db/schema";
import { UNIX_EPOCH } from "./src/db/constants";
import { Discord } from "elysia-oauth2";

import { eq, gt, sql } from "drizzle-orm";

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
    userId: DiscordUser.discordId,
  })
  .from(DiscordUser)
  .where(gt(DiscordUser.expiresAt, sql`${UNIX_EPOCH} - ${DAYS}`));

for (const { refreshToken, userId } of refreshTokens) {
  const tokens = await discord.refreshAccessToken(refreshToken);
  await db
    .update(DiscordUser)
    .set({
      accessToken: tokens.accessToken(),
      refreshToken: tokens.refreshToken(),
      expiresAt: sql`${UNIX_EPOCH} + ${tokens.accessTokenExpiresInSeconds()}`,
    })
    .where(eq(DiscordUser.discordId, userId));
}
