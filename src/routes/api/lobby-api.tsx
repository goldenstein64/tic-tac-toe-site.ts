import type { Static } from "elysia";
import type { Mark } from "@goldenstein64/tic-tac-toe";

import html, { Html } from "@elysiajs/html";
import Elysia, { t, type status } from "elysia";
import { randomInt } from "node:crypto";

import { gameStates } from "#/src/game/game-state";
import runGame from "#/src/game/run-game";
import { TLobbyType } from "#/src/types";
import { tx } from "#/src/db";
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
} from "#/src/db/queries";
import { jwtMustAuth } from "#/src/auth/jwt-auth";
import {
  ActiveLobbies,
  AvailableLobbies,
  FinishedLobbies,
  WaitingLobbies,
} from "#/src/components/lobbies";
import { csrf } from "elysia-csrf";

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

class StatusError extends Error {
  statusArgs: Parameters<typeof status>;

  constructor(...args: Parameters<typeof status>) {
    super(String(args[1]));
    this.statusArgs = args;
  }
}

function throwOnLobbyNotFound(lobbyId: number) {
  const lobby = selectLobbyStatusById.get({ lobbyId });
  if (lobby === undefined) {
    throw new StatusError("Not Found", "lobby does not exist");
  }
}

const PostLobby = new Elysia()
  .use(jwtMustAuth())
  .use(csrf({ cookie: { key: "_csrf" } }))
  .post(
    "/lobby",
    async ({ body: { typeX, typeO }, user: { id: userId }, set, status }) => {
      // create a new lobby
      const computerIdX = typeX === -1 ? undefined : typeX;
      const computerIdO = typeO === -1 ? undefined : typeO;

      if (computerIdX !== undefined && computerIdO !== undefined) {
        // both are computers, compute the game ASAP and create a finished lobby
        const { moves, winner: winnerMark } = await runGame(
          computerIdX,
          computerIdO,
        );
        const winner =
          winnerMark === "X" ? computerIdX
          : winnerMark === "O" ? computerIdO
          : undefined;

        await tx(() => {
          const { id: lobbyId } = insertLobby.get({
            userId,
            status: "finished",
          })!;
          insertGame.run({
            lobbyId,
            playerX: computerIdX,
            playerO: computerIdO,
          });
          insertMoves({ lobbyId, moves });
          insertFinishedLobby.run({ lobbyId, winner });
          set.headers["HX-Redirect"] = `/game?id=${lobbyId}`;
          return Promise.resolve();
        });
      } else if (computerIdX !== undefined || computerIdO !== undefined) {
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

      return status("Created");
    },
    {
      parse: "application/x-www-form-urlencoded",
      body: t.Object({
        typeX: PlayerTypeString,
        typeO: PlayerTypeString,
        _csrf: t.String(),
      }),
    },
  );

export default new Elysia()
  .use(PostLobby)
  .use(html())
  .use(jwtMustAuth())
  .get(
    "/lobby/status",
    ({ query: { id: lobbyId }, set, headers, status }) => {
      const lobby = selectLobbyStatusById.get({ lobbyId });
      if (lobby === undefined) {
        return status("Not Found", "lobby does not exist");
      }

      const lobbyStatus = lobby.status;
      if (lobbyStatus === "active" && headers["x-trigger-refresh"] === "true") {
        set.headers["HX-Refresh"] = "true";
      }
      return lobbyStatus;
    },
    {
      query: t.Object({ id: t.Numeric() }),
      response: { [200]: t.Optional(LobbyStatus), [404]: t.String() },
      detail: {
        summary: "the status of the lobby with the given id",
        description: `
          - On 200, return \`waiting\`, \`active\`, or \`finished\`.
          - On 404, return error message.
          - On 422, return JSON error message.

          - With header "X-Trigger-Refresh", add "HX-Refresh" header when status
          is \`active\`.
        `,
      },
    },
  )
  .get(
    "/lobby/list",
    async ({ query: { type, page }, user: { id: userId }, status }) => {
      switch (type) {
        case "waiting":
          return <WaitingLobbies userId={userId} page={page} />;
        case "available":
          return <AvailableLobbies userId={userId} page={page} />;
        case "active":
          return <ActiveLobbies userId={userId} page={page} />;
        case "finished":
          return <FinishedLobbies userId={userId} page={page} />;
        default:
          return status("Unprocessable Content");
      }
    },
    {
      query: t.Object({ type: TLobbyType, page: t.Numeric() }),
      detail: {
        summary: "a list of lobbies with the given lobby type",
        description: `
          - On 200, return an HTML list of lobbies.
        `,
      },
    },
  )
  .patch(
    "/lobby/forfeit",
    async ({ body: { id: lobbyId }, user: { id: userId }, status }) => {
      try {
        return await tx(async () => {
          throwOnLobbyNotFound(lobbyId);
          const playerResult = selectPlayerInGame.get({ lobbyId, userId });
          if (playerResult === undefined) {
            throw new StatusError(
              "Conflict",
              "lobby does not contain this user",
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

          const state = gameStates.get(lobbyId);
          if (state) {
            state.emit("end", winnerMark);
          } else {
            const lobby = updateLobbyStatus({
              lobbyId,
              fromStatus: "active",
              toStatus: "finished",
            });

            if (lobby === undefined) {
              // may be thrown if fromStatus was not "active"
              throw new StatusError("Conflict", "lobby is not active");
            }

            insertFinishedLobby.run({ lobbyId, winner });
          }

          return status("No Content");
        });
      } catch (err) {
        if (err instanceof StatusError) {
          return status(...err.statusArgs);
        } else {
          throw err;
        }
      }
    },
    { body: t.Object({ id: t.Numeric() }) },
  )
  .patch(
    "/lobby/join",
    async ({ body: { id: lobbyId }, user: { id: userId }, status }) => {
      try {
        return await tx(async () => {
          throwOnLobbyNotFound(lobbyId);

          const lobby = updateLobbyStatus({
            lobbyId,
            fromStatus: "waiting",
            toStatus: "active",
          });
          if (lobby === undefined) {
            throw new StatusError(
              "Unprocessable Content",
              "lobby is not waiting",
            );
          } else if (lobby.createdBy === userId) {
            throw new StatusError(
              "Unprocessable Content",
              "attempt to join own lobby",
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

          return status("No Content");
        });
      } catch (err) {
        if (err instanceof StatusError) {
          return status(...err.statusArgs);
        } else {
          throw err;
        }
      }
    },
    { body: t.Object({ id: t.Numeric() }) },
  )
  .delete(
    "/lobby",
    async ({ query: { id: lobbyId }, set, user: { id: userId }, status }) => {
      // delete a waiting lobby
      const lobby = selectLobbyByIdStatusCreatedBy({
        lobbyId,
        createdBy: userId,
        status: "waiting",
      });
      if (lobby === undefined) {
        // this is not a waiting lobby or it was not created by them
        return status(403, "not a waiting lobby or not created by user");
      }

      deleteLobbyById.run({ id: lobbyId });

      // otherwise, I guess reload the page after changing the db
      set.headers["HX-Refresh"] = "true";
    },
    { query: t.Object({ id: t.Numeric() }) },
  );
