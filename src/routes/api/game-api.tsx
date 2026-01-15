import type { Mark, Board } from "@goldenstein64/tic-tac-toe";
import type { SSEPayload } from "elysia";

import { on } from "node:events";
import { Elysia, t, sse } from "elysia";
import html, { Html } from "@elysiajs/html";

import jwtAuth from "#/src/auth/jwt-auth";
import { orderingToMark } from "#/src/game/run-game";
import { gameStates, GameStateEvents } from "#/src/game/game-state";
import { intString } from "#/src/types";
import { GameRows } from "#/src/components/game-active";
import {
  selectPlayersInGame,
  selectMaxOrdering,
  selectUsernameById,
  selectLobbyStatusById,
} from "#/src/db/queries";

namespace MoveStream {
  export type MoveStreamContext = {
    board: Board;
    userIsX: boolean;
    isClientPlaying: boolean;
    lobbyId: number;
  };
}

class MoveStream {
  public board: Board;
  public userIsX: boolean;
  public isClientPlaying: boolean;
  public lobbyId: number;

  constructor(ctx: MoveStream.MoveStreamContext) {
    this.board = ctx.board;
    this.userIsX = ctx.userIsX;
    this.isClientPlaying = ctx.isClientPlaying;
    this.lobbyId = ctx.lobbyId;
  }

  async *onNewMove(ordering: number): AsyncGenerator<SSEPayload> {
    const { lobbyId, board } = this;
    const nextTurnIsX = orderingToMark(ordering + 1) === "X";
    const enabled = this.isClientPlaying && this.userIsX === nextTurnIsX;

    yield sse({
      event: "board",
      data: await (
        <GameRows lobbyId={lobbyId} board={board} disabled={!enabled} />
      ),
    });
  }

  async *onEnded(winnerMark: Mark | null): AsyncGenerator<SSEPayload> {
    const { lobbyId } = this;
    const { playerX, playerO } = selectPlayersInGame.get({ lobbyId })!;

    yield sse({
      event: "winner",
      data:
        winnerMark ?
          selectUsernameById.get({
            userId: winnerMark === "X" ? playerX : playerO,
          })!.username
        : "no one",
    });
    yield sse({ event: "status", data: "finished" });
    yield sse({ event: "end", data: "finished" });
  }
}

export default new Elysia()
  .use(html())
  .use(jwtAuth())
  .resolve(({ user }) => ({ user: user! }))
  .get(
    "/game/is-asleep",
    ({ query: { id: lobbyId }, headers, set }) => {
      const status = selectLobbyStatusById.get({ lobbyId })?.status;
      const isAsleep = status === "active" && !gameStates.has(lobbyId);
      if (!isAsleep && headers["x-trigger-refresh"] === "true") {
        set.headers["HX-Refresh"] = "true";
      }
      return isAsleep;
    },
    { query: t.Object({ id: intString }), response: t.Boolean() }
  )
  .post(
    "/game-move",
    ({
      body: { id: lobbyId, position },
      user: { id: userId },
      status,
      set,
    }) => {
      const players = selectPlayersInGame.get({ lobbyId });
      if (!players) return status("Not Found");
      const { playerX, playerO } = players;
      if (playerX !== userId && playerO !== userId)
        return status("Unauthorized");

      if (!gameStates.has(lobbyId)) {
        // lobby is asleep, reload it to wake it up
        set.headers["HX-Refresh"] = "true";
      }

      const state = gameStates.getOrCreate(lobbyId);
      if (!state.canMark(position)) return status("Unauthorized");

      const maxOrderResult = selectMaxOrdering.get({ lobbyId });
      const ordering = (maxOrderResult?.maxOrdering ?? -1) + 1;
      state.setMark(position, ordering);
      state.resetSleep();
      return status("No Content");
    },
    {
      body: t.Object({ id: intString, position: intString }),
      parse: "application/x-www-form-urlencoded",
    }
  )
  .get(
    "/game-move",
    async function* ({
      query: { id: lobbyId },
      user: { id: userId },
      set,
      status,
      request,
      headers: { accept },
    }) {
      const players = selectPlayersInGame.get({ lobbyId });
      if (!players) return status("Not Found");
      if (accept !== "text/event-stream") return status("Not Found");

      // headers specific to SSEs
      set.headers["X-Accel-Buffering"] = "no";
      set.headers["Cache-Control"] = "no-cache";
      set.headers["Content-Type"] = "text/event-stream";

      const state = gameStates.getOrCreate(lobbyId);
      const { playerX, playerO } = players;
      const userIsX = userId === playerX;

      const moveStream = new MoveStream({
        board: state.board,
        userIsX,
        isClientPlaying: userIsX || userId == playerO,
        lobbyId,
      });

      const onMoveStream = on(state, "move-stream", {
        signal: request.signal,
      }) as AsyncIterable<GameStateEvents["move-stream"]>;
      for await (const [name, args] of onMoveStream) {
        switch (name) {
          case "new-move":
            yield* moveStream.onNewMove(...args);
            break;
          case "end":
            yield* moveStream.onEnded(...args);
            return;
          case "sleep":
            yield sse({ event: "end", data: "asleep" });
            return;
        }
      }
    },
    { query: t.Object({ id: intString }) }
  );
