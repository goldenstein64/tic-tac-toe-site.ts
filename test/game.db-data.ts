import { User, Game, Lobby } from "../src/db/schema";
import prodInitData from "../game.db-data";

export default async function writeInitialData(dbPath: string) {
  const db = await prodInitData(dbPath);

  // UTC, 24-hour time
  const debugCreated = new Date(Date.UTC(2024, 11 - 1, 16, 3, 5)); // 2024/11/16 3:05

  const refreshKey = 1;
  const insertDebugUser = db.insert(User).values({
    id: 4,
    username: "DebugUser",
    createdAt: debugCreated,
    refreshKey,
  });

  console.log(insertDebugUser.toSQL());
  await insertDebugUser;

  const insertDebugLobby = db.insert(Lobby).values({
    id: 1,
    createdBy: 4,
    status: "active",
  });

  console.log(insertDebugLobby.toSQL());
  await insertDebugLobby;

  const insertDebugGame = db.insert(Game).values({
    lobbyId: 1,
    playerX: 4, // debug user
    playerO: 1, // easy computer
  });

  console.log(insertDebugGame.toSQL());
  await insertDebugGame;
}
