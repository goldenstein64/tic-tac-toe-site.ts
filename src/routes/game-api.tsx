import type { Emitter, EventType } from "mitt";
import type { Mark } from "@goldenstein64/tic-tac-toe/lib";

import { Elysia, t } from "elysia";
import mitt from "mitt";
import { Board } from "@goldenstein64/tic-tac-toe/lib";
import { Html } from "@elysiajs/html";
import { eq, max, sql } from "drizzle-orm";

import { db } from "../db";
import { intString } from "../types";
import { Move } from "../db/schema";
import { GameButton } from "../components/game";

const selectMaxOrdering = db
  .select({ ordering: max(Move.ordering) })
  .from(Move)
  .where(eq(Move.gameId, sql.placeholder("gameId")))
  .prepare();

const insertMove = db
  .insert(Move)
  .values({
    gameId: sql.placeholder("gameId"),
    ordering: sql.placeholder("ordering"),
    position: sql.placeholder("position"),
  })
  .prepare();

type GameState = {
  event: Emitter<{ message: [number, number] }>;
  board: Board;
};

const gameStates = new Map<number, GameState>();
function getGameState(gameId: number): GameState {
  let state = gameStates.get(gameId);
  if (state === undefined) {
    state = {
      event: mitt(),
      board: new Board(),
    };
    gameStates.set(gameId, state);
  }
  return state;
}

function orderingToMark(ordering: number): Mark {
  return ordering % 2 === 1 ? "X" : "O";
}

function waitForEvent<K extends Record<EventType, unknown>>(
  emitter: Emitter<K>,
  type: keyof K
): Promise<K[keyof K]> {
  return new Promise((resolve) => {
    function listener(args: K[keyof K]): void {
      resolve(args);
      emitter.off(type, listener);
    }
    emitter.on(type, listener);
  });
}

export default new Elysia({ prefix: "/api" })
  .post(
    "/game-move",
    async function addMove({ body, set }) {
      const { id: gameId, position } = body;
      const result = selectMaxOrdering.get({ gameId });
      const ordering = (result?.ordering ?? 0) + 1;

      insertMove.run({ gameId, ordering, position });
      const { board, event } = getGameState(gameId);
      const mark = orderingToMark(ordering);
      board.data[position - 1] = mark;
      event.emit("message", [ordering, position]);

      set.headers["Content-Type"] = "text/html";
      return (
        <GameButton disabled={true} gameId={gameId} position={position}>
          {mark}
        </GameButton>
      );
    },
    {
      body: t.Object({
        id: intString,
        position: intString,
      }),
      type: "application/x-www-form-urlencoded",
    }
  )
  .get(
    "/game-move",
    async function* getMoveStream({ query, set }) {
      const { id: gameId } = query;
      set.headers["X-Accel-Buffering"] = "no";
      set.headers["Cache-Control"] = "no-cache";
      set.headers["Content-Type"] = "text/event-stream";

      const { board, event } = getGameState(gameId);

      while (true) {
        const [ordering, position] = await waitForEvent(event, "message");
        const mark = orderingToMark(ordering);
        yield `event: pos-${position}\n`;
        yield `data: ${(
          <GameButton disabled={false} gameId={gameId} position={position}>
            {mark}
          </GameButton>
        )}\n\n`;

        // disable one player's buttons, and enable the other's
        // that would require me to know which player this is!
        // should I figure it out via JWT and looking at the db?
        // I kinda wanna do sessions tho (lol)

        if (board.won(mark)) {
          yield "event: winner\n";
          yield `data: ${mark}\n\n`;
          // disable all the buttons
          break;
        } else if (board.full()) {
          yield "event: winner\n";
          yield "data: no one\n\n";
          break;
        }
      }
    },
    { query: t.Object({ id: intString }) }
  );
