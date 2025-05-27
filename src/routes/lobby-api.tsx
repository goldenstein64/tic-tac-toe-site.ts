import type { Static } from "elysia";
import type { Mark } from "@goldenstein64/tic-tac-toe";

import html from "@elysiajs/html";
import Elysia, { t, type status } from "elysia";
import { randomInt } from "node:crypto";

import { gameStates } from "../libs/game-state";
import { intString } from "../types";
import { tx } from "../db";
import {
  updateLobbyStatus,
  selectPlayerInGame,
  insertFinishedLobby,
  insertGame,
  insertLobby,
  insertMoves,
  selectLobbyByIdStatusCreatedBy,
  deleteLobbyById,
  selectLobbyStatusById,
} from "../db/queries";
import runGame from "../libs/run-game";
import jwtAuth from "../libs/jwt-auth";

const LobbyAction = t.Union([t.Literal("forfeit"), t.Literal("join")]);
export type LobbyAction = Static<typeof LobbyAction>;

const LobbyStatus = t.Union([
  t.Literal("waiting"),
  t.Literal("active"),
  t.Literal("finished"),
]);

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

class CustomRollbackError extends Error {}
class ResponseError extends Error {
  errorObject: ReturnType<typeof status>;

  constructor(sts: typeof status, ...args: Parameters<typeof status>) {
    super((args[1] as object).toString());
    this.errorObject = sts(...args);
  }
}

type ForfeitResult =
  | { success: true }
  | { success: false; message: string }
  | ReturnType<typeof status>;

async function forfeitActiveLobby(
  sts: typeof status,
  lobbyId: number,
  userId: number
): Promise<ForfeitResult> {
  try {
    return await tx(async () => {
      const playerResult = selectPlayerInGame.get({ lobbyId, userId });
      if (playerResult === undefined) {
        throw new ResponseError(
          sts,
          "Forbidden",
          "lobby does not exist or does not contain this user"
        );
      }

      const { playerX, playerO } = playerResult;
      let winner: number;
      let winnerMark: Mark;
      if (userId === playerX) {
        winner = playerO;
        winnerMark = "O";
      } else {
        winner = playerX;
        winnerMark = "X";
      }

      const lobby = updateLobbyStatus({
        id: lobbyId,
        fromStatus: "active",
        toStatus: "finished",
      });

      if (lobby === undefined) {
        throw new CustomRollbackError(
          "unable to forfeit game (lobby wasn't active or didn't exist)"
        );
      }

      insertFinishedLobby.run({ lobbyId, winner });

      const state = gameStates.get(lobbyId);
      if (state) {
        state.emit("end", winnerMark);
      }

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
  | ReturnType<typeof status>;

async function joinWaitingLobby(
  lobbyId: number,
  userId: number
): Promise<JoinResult> {
  try {
    return await tx(async () => {
      const lobby = updateLobbyStatus({
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

      // a new game state will be created when needed

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
  .get(
    "/lobby/status",
    ({ query: { id: lobbyId }, set }) => {
      const status = selectLobbyStatusById.get({ lobbyId })?.status;
      if (status === "active") {
        set.headers["HX-Refresh"] = "true";
      }
      return status;
    },
    {
      query: t.Object({ id: intString }),
      response: t.Union([LobbyStatus, t.Undefined()]),
      detail: {
        summary: "returns the status of the lobby with the given id",
        description:
          "From HTMX, the page gets refreshed when the status is active.",
      },
    }
  )
  .patch(
    "/lobby",
    async ({ body: { id: lobbyId, action }, user: { id: userId }, status }) => {
      switch (action) {
        case "forfeit":
          return await forfeitActiveLobby(status, lobbyId, userId);
        case "join":
          return await joinWaitingLobby(lobbyId, userId);
      }
    },
    { body: t.Object({ id: intString, action: LobbyAction }) }
  )
  .post(
    "/lobby",
    async ({ body: { typeX, typeO }, user: { id: userId }, set }) => {
      // create a new lobby
      const computerIdX = typeX === -1 ? undefined : typeX;
      const computerIdO = typeO === -1 ? undefined : typeO;

      if (computerIdX && computerIdO) {
        // both are computers, compute the game ASAP and create a finished lobby
        const [moves, winnerMark] = await runGame(computerIdX, computerIdO);
        const winner =
          winnerMark === "X" ? computerIdX
          : winnerMark === "O" ? computerIdO
          : undefined;

        await tx(async () => {
          const { id: lobbyId } = insertLobby.get({
            userId,
            status: "finished",
          })!;
          await insertGame.execute({
            lobbyId,
            playerX: computerIdX,
            playerO: computerIdO,
          });
          insertMoves({ lobbyId, moves });
          insertFinishedLobby.run({ lobbyId, winner });
          set.headers["HX-Redirect"] = `/game?id=${lobbyId}`;
        });
      } else if (computerIdX || computerIdO) {
        // only one is a computer, create an active lobby with this user as the
        // human
        await tx(async () => {
          const { id: lobbyId } = insertLobby.get({
            userId,
            status: "active",
          })!;
          insertGame.run({
            lobbyId,
            playerX: computerIdX ?? userId,
            playerO: computerIdO ?? userId,
          });
          set.headers["HX-Redirect"] = `/game?id=${lobbyId}`;
        });
      } else {
        // neither are computers, create a waiting lobby with this user waiting
        const { id: lobbyId } = insertLobby.get({ userId, status: "waiting" })!;
        set.headers["HX-Redirect"] = `/game?id=${lobbyId}`;
      }
    },
    { body: t.Object({ typeX: PlayerTypeString, typeO: PlayerTypeString }) }
  )
  .delete(
    "/lobby",
    async ({ query: { id }, set, user: { id: userId }, status }) => {
      // delete a waiting lobby
      const lobby = selectLobbyByIdStatusCreatedBy.get({
        lobbyId: id,
        createdBy: userId,
        status: "waiting",
      });
      if (lobby === undefined) {
        // this is not a waiting lobby or it was not created by them
        return status(403, "not a waiting lobby or not created by user");
      }

      deleteLobbyById.run({ id });

      // otherwise, I guess reload the page after changing the db
      set.headers["HX-Refresh"] = "true";
    },
    { query: t.Object({ id: intString }) }
  );
