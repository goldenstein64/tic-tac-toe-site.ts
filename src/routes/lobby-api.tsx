import type { LobbyStatus } from "../db/datatypes";
import type { Static } from "elysia";

import html, { Html } from "@elysiajs/html";
import Elysia, { error, t } from "elysia";
import { and, eq, or, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";

import { intString } from "../types";
import { db, tx, typePrepared } from "../db";
import { FinishedLobby, Game, Lobby, Move } from "../db/schema";
import runGame from "../libs/run-game";
import jwtAuth from "../libs/jwt-auth";

const _placeholders: any = undefined;

const LobbyAction = t.Union([t.Literal("forfeit"), t.Literal("join")]);
export type LobbyAction = Static<typeof LobbyAction>;

const playerTypeSet = [-1, 1, 2, 3] as const;

const PlayerType = t.Union(playerTypeSet.map((p) => t.Literal(p)));
type PlayerType = Static<typeof PlayerType>;

const PlayerTypeString = t
  .Transform(t.String())
  .Decode((value: string) => {
    const intValue = parseInt(value);

    if (playerTypeSet.includes(intValue as PlayerType)) {
      return intValue as PlayerType;
    } else {
      throw new Error("passed in value is not a PlayerType");
    }
  })
  .Encode((value: PlayerType) => value.toString());

const selectLobbyByIdStatusCreatedBy = typePrepared(
  db
    .select({ id: Lobby.id })
    .from(Lobby)
    .where(
      and(
        eq(Lobby.id, sql.placeholder("lobbyId")),
        eq(Lobby.createdBy, sql.placeholder("createdBy")),
        eq(Lobby.status, sql.placeholder("status"))
      )
    )
    .prepare(),
  _placeholders as { lobbyId: number; createdBy: number; status: LobbyStatus }
);

const insertGame = typePrepared(
  db
    .insert(Game)
    .values({
      lobbyId: sql.placeholder("lobbyId"),
      playerX: sql.placeholder("playerX"),
      playerO: sql.placeholder("playerO"),
    })
    .prepare(),
  _placeholders as { lobbyId: number; playerX: number; playerO: number }
);

const insertLobby = typePrepared(
  db
    .insert(Lobby)
    .values({
      createdBy: sql.placeholder("userId"),
      status: sql.placeholder("status"),
    })
    .returning({ id: Lobby.id, createdAt: Lobby.createdAt })
    .prepare(),
  _placeholders as { userId: number; status: LobbyStatus }
);

const deleteLobbyById = typePrepared(
  db
    .delete(Lobby)
    .where(eq(Lobby.id, sql.placeholder("id")))
    .prepare(),
  _placeholders as { id: number }
);

const selectPlayerInGame = typePrepared(
  db
    .select({ playerX: Game.playerX, playerO: Game.playerO })
    .from(Game)
    .where(
      and(
        eq(Game.lobbyId, sql.placeholder("lobbyId")),
        or(
          eq(Game.playerX, sql.placeholder("userId")),
          eq(Game.playerO, sql.placeholder("userId"))
        )
      )
    )
    .prepare(),
  _placeholders as { lobbyId: number; userId: number }
);

const insertFinishedLobby = typePrepared(
  db
    .insert(FinishedLobby)
    .values({ id: sql.placeholder("id") })
    .prepare(),
  _placeholders as { id: number }
);

async function updateLobbyStatus(args: {
  id: number;
  toStatus: LobbyStatus;
  fromStatus: LobbyStatus;
}) {
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
}

async function insertMoves(args: { lobbyId: number; moves: number[] }) {
  const { lobbyId, moves } = args;
  await db.insert(Move).values(
    moves.map((position, i) => ({
      lobbyId,
      ordering: i + 1,
      position: position + 1,
    }))
  );
}

class CustomRollbackError extends Error {}
class ResponseError extends Error {
  errorObject: ReturnType<typeof error>;

  constructor(code: Parameters<typeof error>[0], response?: string) {
    super(response);
    this.errorObject = error(code, response);
  }
}

type ForfeitResult =
  | { success: true }
  | { success: false; message: string }
  | ReturnType<typeof error>;

async function forfeitActiveLobby(
  lobbyId: number,
  userId: number
): Promise<ForfeitResult> {
  try {
    return await tx(async () => {
      const playerResult = selectPlayerInGame.get({ lobbyId, userId });
      if (
        playerResult === undefined ||
        (playerResult.playerX !== userId && playerResult.playerO !== userId)
      ) {
        throw new ResponseError("Forbidden");
      }

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

      insertFinishedLobby.run({ id: lobbyId });
      return { success: true };
    });
  } catch (err) {
    if (err instanceof CustomRollbackError) {
      return { success: false, message: err.message };
    } else if (err instanceof ResponseError) {
      return err.errorObject;
    } else {
      throw err;
    }
  }
}

type JoinResult =
  | { success: true }
  | { success: false; message: string }
  | ReturnType<typeof error>;

async function joinWaitingLobby(
  lobbyId: number,
  userId: number
): Promise<JoinResult> {
  try {
    return await tx(async () => {
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
      insertGame.run({ lobbyId, playerX, playerO });

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
  .use(jwtAuth())
  .resolve(({ user }) => ({ user: user! }))
  .patch(
    "/lobby",
    async ({ query: { id: lobbyId, action }, user: { id: userId } }) => {
      switch (action) {
        case "forfeit":
          return await forfeitActiveLobby(lobbyId, userId);
        case "join":
          return await joinWaitingLobby(lobbyId, userId);
      }
    },
    { query: t.Object({ id: intString, action: LobbyAction }) }
  )
  .post(
    "/lobby",
    async ({ body: { typeX, typeO }, user: { id: userId } }) => {
      // create a new lobby
      const computerIdX = typeX === -1 ? undefined : typeX;
      const computerIdO = typeO === -1 ? undefined : typeO;

      if (computerIdX && computerIdO) {
        // both are computers, compute the game ASAP and create a finished lobby
        const moves = await runGame(computerIdX, computerIdO);

        await tx(async () => {
          const { id: lobbyId } = insertLobby.get({
            userId,
            status: "finished",
          })!;
          await Promise.all([
            insertGame.execute({
              lobbyId,
              playerX: computerIdX,
              playerO: computerIdO,
            }),
            insertMoves({ lobbyId, moves }),
          ]);
          insertFinishedLobby.run({ id: lobbyId });
        });
      } else if (computerIdX || computerIdO) {
        // only one is a computer, create an active lobby with this user as the
        // human
        await tx(async () => {
          const { id: lobbyId } = insertLobby.get({
            userId,
            status: "active",
          })!;
          await insertGame.execute({
            lobbyId,
            playerX: computerIdX ?? userId,
            playerO: computerIdO ?? userId,
          });
        });
      } else {
        // neither are computers, create a waiting lobby with this user waiting
        insertLobby.run({ userId, status: "waiting" });
      }
    },
    { body: t.Object({ typeX: PlayerTypeString, typeO: PlayerTypeString }) }
  )
  .delete(
    "/lobby",
    async ({ query: { id }, set, user: { id: userId } }) => {
      // delete a waiting lobby
      const lobby = selectLobbyByIdStatusCreatedBy.get({
        lobbyId: id,
        createdBy: userId,
        status: "waiting",
      });
      if (lobby === undefined) {
        // this is not a waiting lobby or it was not created by them
        return error(403, "not a waiting lobby or not created by user");
      }

      deleteLobbyById.run({ id });

      // otherwise, I guess reload the page after changing the db
      set.headers["HX-Refresh"] = "true";
    },
    { query: t.Object({ id: intString }) }
  );
