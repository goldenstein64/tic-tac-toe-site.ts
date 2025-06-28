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

type MoveStreamContext = {
  board: Board;
  userIsX: boolean;
  isClientPlaying: boolean;
  lobbyId: number;
};

async function* onNewMove(
  { userIsX, isClientPlaying, lobbyId, board }: MoveStreamContext,
  ordering: number
): AsyncGenerator<SSEPayload> {
  const nextTurn = orderingToMark(ordering + 1);
  const enabled = isClientPlaying && userIsX === (nextTurn === "X");
  yield sse({
    event: "board",
    data: await (
      <GameRows lobbyId={lobbyId} board={board} disabled={!enabled} />
    ),
  });
}

async function* onEnded(
  { board, lobbyId }: MoveStreamContext,
  winnerMark: Mark | null
): AsyncGenerator<SSEPayload> {
  const { playerX, playerO } = selectPlayersInGame.get({ lobbyId })!;

  yield sse({
    event: "board",
    data: await (<GameRows lobbyId={lobbyId} board={board} disabled />),
  });
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

      const state = gameStates.getOrCreate(lobbyId, playerX, playerO);
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
    }) {
      const players = selectPlayersInGame.get({ lobbyId });
      if (!players) return status("Not Found");

      set.headers["X-Accel-Buffering"] = "no";
      set.headers["Cache-Control"] = "no-cache";
      set.headers["Content-Type"] = "text/event-stream";

      const { playerX, playerO } = players;
      const state = gameStates.getOrCreate(lobbyId, playerX, playerO);
      const userIsX = userId === playerX;

      const moveStreamCtx: MoveStreamContext = {
        board: state.board,
        userIsX,
        isClientPlaying: userIsX || userId === playerO,
        lobbyId,
      };
      const onMoveStream = on(state, "move-stream") as AsyncIterable<
        GameStateEvents["move-stream"]
      >;
      for await (const [name, args] of onMoveStream) {
        switch (name) {
          case "new-move":
            yield* onNewMove(moveStreamCtx, ...args);
            break;
          case "end":
            yield* onEnded(moveStreamCtx, ...args);
            return;
        }
      }
    },
    { query: t.Object({ id: intString }) }
  );
