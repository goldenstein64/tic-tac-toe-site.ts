import type { Mark, Board } from "@goldenstein64/tic-tac-toe";
import type { SSEPayload } from "elysia";

import { on } from "node:events";
import { Elysia, t, sse } from "elysia";
import html, { Html } from "@elysiajs/html";

import jwtAuth from "../libs/jwt-auth";
import { orderingToMark } from "../libs/run-game";
import { intString } from "../types";
import { GameRows } from "../components/game-active";
import { gameStates, GameStateEvents } from "../libs/game-state";
import {
  selectPlayersInGame,
  selectMaxOrdering,
  selectUsernameById,
} from "../db/queries";

class MoveStream {
  constructor(
    public board: Board,
    public userIsX: boolean,
    public isClientPlaying: boolean,
    public lobbyId: number
  ) {}

  async *onNewMove(ordering: number): AsyncGenerator<SSEPayload> {
    const { lobbyId, board } = this;
    const nextTurn = orderingToMark(ordering + 1);
    const enabled = this.isClientPlaying && this.userIsX === (nextTurn === "X");

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
    yield sse({ event: "end" });
  }
}

export default new Elysia({ prefix: "/api" })
  .use(html())
  .use(jwtAuth())
  .resolve(({ user }) => ({ user: user! }))
  .post(
    "/game-move",
    ({ body: { id: lobbyId, position }, user: { id: userId }, status }) => {
      const players = selectPlayersInGame.get({ lobbyId });
      if (!players) return status("Not Found");
      const { playerX, playerO } = players;
      if (playerX !== userId && playerO !== userId)
        return status("Unauthorized");

      const state = gameStates.getOrCreate(lobbyId);
      if (!state.canMark(position)) return status("Unauthorized");

      const maxOrderResult = selectMaxOrdering.get({ lobbyId });
      const ordering = (maxOrderResult?.maxOrdering ?? -1) + 1;
      state.setMark(position, ordering);
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

      const moveStream = new MoveStream(
        /* board */ state.board,
        userIsX,
        /* isClientPlaying: */ userIsX || userId == playerO,
        lobbyId
      );

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
        }
      }
    },
    { query: t.Object({ id: intString }) }
  );
