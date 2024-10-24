import type { LobbyStatus } from "../db/schema";

import html, { Html } from "@elysiajs/html";
import Elysia, { error, Static, t } from "elysia";
import { and, eq, exists, or, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";

import { intString } from "../types";
import { db, tx } from "../db";
import { ActiveLobby, FinishedLobby, Game, Lobby, Move } from "../db/schema";
import runGame from "../libs/run-game";

export type LobbyAction = "forfeit" | "join";

const LobbyAction = t.Union([t.Literal("forfeit"), t.Literal("join")]);

const playerTypeSet = [-1, 1, 2, 3];

const PlayerType = t.Union([
  t.Literal(-1),
  t.Literal(1),
  t.Literal(2),
  t.Literal(3),
]);
type PlayerType = Static<typeof PlayerType>;

const PlayerTypeString = t
  .Transform(t.String())
  .Decode((value: string) => {
    const intValue = parseInt(value);

    if (playerTypeSet.includes(intValue)) {
      return intValue as PlayerType;
    } else {
      throw new Error("passed in value is not a PlayerType");
    }
  })
  .Encode((value: PlayerType) => value.toString());

const selectLobbyByIdSql = db
  .select({ status: Lobby.status, createdBy: Lobby.createdBy })
  .from(Lobby)
  .where(eq(Lobby.id, sql.placeholder("lobbyId")))
  .prepare();
const selectLobbyById = async (args: { lobbyId: number }) => {
  const result = await selectLobbyByIdSql.execute(args);
  return result.length > 0 ? result[0] : undefined;
};

const selectLobbyByIdStatusCreatedBySql = db
  .select({ id: Lobby.id })
  .from(Lobby)
  .where(
    and(
      eq(Lobby.id, sql.placeholder("lobbyId")),
      eq(Lobby.createdBy, sql.placeholder("createdBy")),
      eq(Lobby.status, sql.placeholder("status"))
    )
  )
  .prepare();
const selectLobbyByIdStatusCreatedBy = async (args: {
  lobbyId: number;
  createdBy: number;
  status: LobbyStatus;
}) => {
  const result = await selectLobbyByIdStatusCreatedBySql.execute(args);
  if (result.length > 1) {
    throw new Error("returned more than one lobby!");
  }

  return result.length > 0 ? result[0].id : undefined;
};

const insertGameSql = db
  .insert(Game)
  .values({
    playerX: sql.placeholder("playerX"),
    playerO: sql.placeholder("playerO"),
  })
  .returning({ id: Game.id })
  .prepare();
const insertGame = async (args: { playerX: number; playerO: number }) => {
  const result = await insertGameSql.execute(args);
  if (result.length <= 0) {
    throw new Error("unable to insert game!");
  }
  return result[0].id;
};

const insertLobbySql = db
  .insert(Lobby)
  .values({
    createdBy: sql.placeholder("userId"),
    status: sql.placeholder("status"),
  })
  .returning({ id: Lobby.id, createdAt: Lobby.createdAt })
  .prepare();
const insertLobby = async (args: { userId: number; status: LobbyStatus }) => {
  const result = await insertLobbySql.execute(args);
  if (result.length <= 0) throw new Error("unable to insert lobby!");

  return result[0];
};

const updateLobbyStatus = async (args: {
  id: number;
  toStatus: LobbyStatus;
  fromStatus: LobbyStatus;
}) => {
  const { id, toStatus, fromStatus } = args;
  const result = await db
    .update(Lobby)
    .set({ status: toStatus })
    .where(and(eq(Lobby.id, id), eq(Lobby.status, fromStatus)))
    .returning({ status: Lobby.status, createdBy: Lobby.createdBy });

  if (result.length > 1) {
    throw new Error("updated more than one lobby!");
  }

  return result.length === 1 ? result[0] : undefined;
};

const insertActiveLobbySql = db
  .insert(ActiveLobby)
  .values({ gameId: sql.placeholder("gameId"), id: sql.placeholder("id") })
  .prepare();
const insertActiveLobby = async (args: { gameId: number; id: number }) => {
  return await insertActiveLobbySql.execute(args);
};

const deleteActiveLobbySql = db
  .delete(ActiveLobby)
  .where(
    and(
      eq(ActiveLobby.id, sql.placeholder("lobbyId")),
      exists(
        db
          .select()
          .from(Game)
          .where(
            and(
              eq(Game.id, ActiveLobby.gameId),
              or(
                eq(Game.playerX, sql.placeholder("userId")),
                eq(Game.playerO, sql.placeholder("userId"))
              )
            )
          )
      )
    )
  )
  .returning({ gameId: ActiveLobby.gameId })
  .prepare();
const deleteActiveLobby = async (args: { lobbyId: number; userId: number }) => {
  const result = await deleteActiveLobbySql.execute(args);
  if (result.length > 1) {
    throw new Error("removed more than one active lobby!");
  }
  return result.length === 1 ? result[0].gameId : undefined;
};

const insertFinishedLobbySql = db
  .insert(FinishedLobby)
  .values({ gameId: sql.placeholder("gameId"), id: sql.placeholder("id") })
  .prepare();
const insertFinishedLobby = async (args: { gameId: number; id: number }) => {
  return await insertFinishedLobbySql.execute(args);
};

const insertMoves = async (args: { gameId: number; moves: number[] }) => {
  const { gameId, moves } = args;
  await db.insert(Move).values(
    moves.map((position, i) => ({
      gameId,
      ordering: i + 1,
      position: position + 1,
    }))
  );
};

class CustomRollbackError extends Error {}

type ForfeitResult = { success: true } | { success: false; message: string };

async function forfeitActiveLobby(
  lobbyId: number,
  userId: number
): Promise<ForfeitResult> {
  try {
    return await tx.transaction(async () => {
      const lobby = await updateLobbyStatus({
        id: lobbyId,
        fromStatus: "active",
        toStatus: "finished",
      });

      if (lobby === undefined) {
        throw new CustomRollbackError(
          "unable to forfeit game (lobby wasn't active or didn't exist)"
        );
      }

      const activeGameId = await deleteActiveLobby({ lobbyId, userId });
      if (activeGameId === undefined) {
        throw new CustomRollbackError(
          "unable to forfeit game (active row didn't exist or user wasn't part of the game)"
        );
      }

      await insertFinishedLobby({ gameId: activeGameId, id: lobbyId });
      return { success: true };
    });
  } catch (err) {
    if (err instanceof CustomRollbackError) {
      return { success: false, message: err.message };
    } else {
      throw err;
    }
  }
}

type JoinResult = { success: true } | { success: false; message: string };

async function joinWaitingLobby(
  lobbyId: number,
  userId: number
): Promise<JoinResult> {
  try {
    return await tx.transaction(async () => {
      const lobby = await updateLobbyStatus({
        id: lobbyId,
        fromStatus: "waiting",
        toStatus: "active",
      });
      if (lobby === undefined) {
        throw new CustomRollbackError(
          "unable to join lobby (deleted or not waiting)"
        );
      }

      // choose who will be Xs or Os
      let playerX: number, playerO: number;
      if (randomInt(2) === 0) {
        playerX = userId;
        playerO = lobby.createdBy;
      } else {
        playerX = lobby.createdBy;
        playerO = userId;
      }

      // add a Game and ActiveLobby row
      const gameId = await insertGame({ playerX, playerO });

      await insertActiveLobby({ gameId, id: lobbyId });
      return { success: true };
    });
  } catch (err) {
    if (err instanceof CustomRollbackError) {
      return { success: false, message: err.message };
    } else {
      throw err;
    }
  }
}

export default new Elysia({ prefix: "/api" })
  .use(html())
  .patch(
    "/lobby",
    async ({
      query: { id: lobbyId, action },
      cookie: { userId: userIdCookie },
    }) => {
      const userId = userIdCookie.value;
      switch (action) {
        case "forfeit":
          return await forfeitActiveLobby(lobbyId, userId);
        case "join":
          return await joinWaitingLobby(lobbyId, userId);
      }
    },
    {
      query: t.Object({ id: intString, action: LobbyAction }),
      cookie: t.Object({ userId: t.Number() }),
    }
  )
  .post(
    "/lobby",
    async ({ body: { typeX, typeO }, cookie: { userId: userIdCookie } }) => {
      const userId = userIdCookie.value;

      // create a new lobby
      const computerIdX = typeX === -1 ? undefined : typeX;
      const computerIdO = typeO === -1 ? undefined : typeO;

      if (computerIdX && computerIdO) {
        // both are computers, compute the game ASAP and create a finished lobby
        const moves = await runGame(computerIdX, computerIdO);

        await tx.transaction(async () => {
          const gameId = await insertGame({
            playerX: computerIdX,
            playerO: computerIdO,
          });
          await insertMoves({ gameId, moves });
          const { id: lobbyId } = await insertLobby({
            userId,
            status: "finished",
          });
          await insertFinishedLobby({ gameId, id: lobbyId });
        });
      } else if (computerIdX || computerIdO) {
        // only one is a computer, create an active lobby with this user as the
        // human
        tx.transaction(async () => {
          const gameId = await insertGame({
            playerX: computerIdX ?? userId,
            playerO: computerIdO ?? userId,
          });
          const { id: lobbyId } = await insertLobby({
            userId,
            status: "active",
          });
          await insertActiveLobby({ gameId, id: lobbyId });
        });
      } else {
        // neither are computers, create a waiting lobby with this user waiting
        await insertLobby({ userId, status: "waiting" });
      }
    },
    {
      body: t.Object({ typeX: PlayerTypeString, typeO: PlayerTypeString }),
      cookie: t.Object({ userId: t.Number() }),
    }
  )
  .delete(
    "/lobby",
    async ({ query: { id }, set, cookie: { userId: userIdCookie } }) => {
      // delete a waiting lobby
      const userId = userIdCookie.value;
      const lobby = await selectLobbyByIdStatusCreatedBy({
        lobbyId: id,
        createdBy: userId,
        status: "waiting",
      });
      if (lobby === undefined) {
        // this is not a waiting lobby or it was not created by them
        return error(403, "not a waiting lobby or not created by user");
      }

      // otherwise, I guess reload the page after changing the db
      set.headers["HX-Refresh"] = "true";
    },
    {
      query: t.Object({ id: intString }),
      cookie: t.Object({ userId: t.Number() }),
    }
  );
