import { Elysia, t } from "elysia";

import { db } from "../db";
import { Game, Lobby } from "../db/schema";
import { sql } from "drizzle-orm";

// 0 = waiting, 1 = active, 2 = finished
type LobbyStatus = 0 | 1 | 2;
type LobbyStatusString = "waiting" | "active" | "finished";

type PlayerType = "human" | "easyComputer" | "mediumComputer" | "hardComputer";

const insertGame = db
  .insert(Game)
  .values({
    playerX: sql.placeholder("playerX"),
    playerO: sql.placeholder("playerO"),
  })
  .returning()
  .prepare();

const insertLobby = db
  .insert(Lobby)
  .values({
    createdBy: sql.placeholder("createdBy"),
    status: sql.placeholder("status"),
  })
  .returning({ id: Lobby.id, createdAt: Lobby.createdAt })
  .prepare();

function insertWaitingLobby(userId: number) {}

const playerType = t.Union([
  t.Literal("human"),
  t.Literal("easyComputer"),
  t.Literal("mediumComputer"),
  t.Literal("hardComputer"),
]);

const ComputerIds: Record<PlayerType, number | undefined> = {
  human: undefined,
  easyComputer: 1,
  mediumComputer: 2,
  hardComputer: 3,
} as const;

const LobbyStatuses: Record<LobbyStatusString, LobbyStatus> = {
  waiting: 0,
  active: 1,
  finished: 2,
} as const;

export default new Elysia({ prefix: "/api" })
  .post(
    "/new-game",
    ({ body, set }) => {
      const { typeX, typeO } = body;
      const computerIdX = ComputerIds[typeX];
      const computerIdO = ComputerIds[typeO];
      if (!computerIdX && !computerIdO) {
        // set up a waiting lobby
        const lobby = insertLobby.get({
          createdBy: 0,
          status: LobbyStatuses.waiting,
        });
      } else if (!computerIdX || !computerIdO) {
        // set up a game and an active lobby
      } else {
        // set up a game, calculate it ASAP, and set up a finished lobby
      }

      // how do I get the newly created game id?

      const gameId = 0;
      set.headers["hx-redirect"] = `./game?id=${gameId}`;
    },
    {
      body: t.Object({
        typeX: playerType,
        typeO: playerType,
      }),
      type: "application/x-www-form-urlencoded",
    }
  )
  .get("/active-games", (ctx) => {}, {})
  .get("/available-games", (ctx) => {}, {});
