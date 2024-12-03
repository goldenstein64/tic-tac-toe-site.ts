import { Html } from "@elysiajs/html";
import { eq, sql } from "drizzle-orm";

import { db, typePrepared } from "../db";
import { Game, SelectUser, User } from "../db/schema";
import { SITE_TITLE } from "../constants";

const _placeholders: any = undefined;

export const selectUserById = typePrepared(
  db
    .select()
    .from(User)
    .where(eq(User.id, sql.placeholder("userId")))
    .prepare(),
  _placeholders as { userId: number }
);

export const selectPlayersInGame = typePrepared(
  db
    .select({ playerX: Game.playerX, playerO: Game.playerO })
    .from(Game)
    .where(eq(Game.lobbyId, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number }
);

export function GameHead() {
  return (
    <head>
      <title>{SITE_TITLE} - Game</title>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <script src="/public/htmx.min.js" />
      <script src="/public/htmx-ext-sse.js" />
      <link rel="stylesheet" href="/public/global.css" />
      <link rel="stylesheet" href="/public/game.css" />
    </head>
  );
}
export function PlayerInfo({ user }: { user?: SelectUser }) {
  if (user) {
    return <aside>{user.username}</aside>;
  } else {
    return <aside />;
  }
}
