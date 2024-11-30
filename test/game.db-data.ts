import { User, Game, Lobby, FinishedLobby, Move } from "../src/db/schema";
import { db } from "../src/db";
import prodInitialData from "../game.db-data";
import { DataConfig } from "../scripts/reset-db";
import runSqlBuilder from "../scripts/util/run-sql-builder";

export default async function testInitialData(config: DataConfig) {
  prodInitialData(config);

  const { quiet = false } = config;

  const runSql = runSqlBuilder(quiet);

  // UTC, 24-hour time
  const debugCreated = new Date(Date.UTC(2024, 11 - 1, 16, 3, 5)); // 2024/11/16 3:05

  runSql(
    db.insert(User).values({
      id: 4,
      username: "DebugUser",
      createdAt: debugCreated,
      refreshKey: 1,
    })
  );

  runSql(
    db.insert(Lobby).values([
      {
        id: 1,
        createdBy: 4, // debug user
        createdAt: new Date(Date.UTC(2024, 11 - 1, 28, 2, 29)),
        status: "waiting",
      },
      {
        id: 2,
        createdBy: 4, // debug user
        createdAt: new Date(Date.UTC(2024, 11 - 1, 28, 2, 30)),
        status: "active",
      },
      {
        id: 3,
        createdBy: 4, // debug user
        createdAt: new Date(Date.UTC(2024, 11 - 1, 28, 2, 31)),
        status: "finished",
      },
    ])
  );

  runSql(
    db.insert(FinishedLobby).values({
      id: 3,
      finishedAt: new Date(Date.UTC(2024, 11 - 1, 28, 2, 32)),
      winner: 4, // debug user
    })
  );

  runSql(
    db.insert(Game).values([
      {
        lobbyId: 2,
        playerX: 4, // debug user
        playerO: 3, // hard computer
      },
      {
        lobbyId: 3,
        playerX: 4, // debug user
        playerO: 1, // easy computer
      },
    ])
  );

  runSql(
    db.insert(Move).values([
      // X - -
      // O O X
      // X - O
      { lobbyId: 2, ordering: 0, position: 0 },
      { lobbyId: 2, ordering: 1, position: 4 },
      { lobbyId: 2, ordering: 2, position: 6 },
      { lobbyId: 2, ordering: 3, position: 3 },
      { lobbyId: 2, ordering: 4, position: 5 },
      { lobbyId: 2, ordering: 5, position: 8 },

      // X X X
      // O - -
      // - - O
      { lobbyId: 3, ordering: 0, position: 0 },
      { lobbyId: 3, ordering: 1, position: 8 },
      { lobbyId: 3, ordering: 2, position: 2 },
      { lobbyId: 3, ordering: 3, position: 3 },
      { lobbyId: 3, ordering: 4, position: 1 },
    ])
  );
}
