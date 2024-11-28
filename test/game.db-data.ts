import { User, Game, Lobby } from "../src/db/schema";
import { db } from "../src/db";
import prodInitialData from "../game.db-data";
import { DataConfig } from "../scripts/reset-db";

export default async function testInitialData(config: DataConfig) {
  prodInitialData(config);

  const { quiet = false } = config;

  // UTC, 24-hour time
  const debugCreated = new Date(Date.UTC(2024, 11 - 1, 16, 3, 5)); // 2024/11/16 3:05

  const refreshKey = 1;
  const insertDebugUser = db.insert(User).values({
    id: 4,
    username: "DebugUser",
    createdAt: debugCreated,
    refreshKey,
  });

  if (!quiet) console.log(insertDebugUser.toSQL());
  insertDebugUser.run();

  const insertDebugLobby = db.insert(Lobby).values({
    id: 1,
    createdBy: 4,
    status: "active",
  });

  if (!quiet) console.log(insertDebugLobby.toSQL());
  insertDebugLobby.run();

  const insertDebugGame = db.insert(Game).values({
    lobbyId: 1,
    playerX: 4, // debug user
    playerO: 1, // easy computer
  });

  if (!quiet) console.log(insertDebugGame.toSQL());
  insertDebugGame.run();
}
