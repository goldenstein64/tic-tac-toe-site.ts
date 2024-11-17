import type { Mark } from "@goldenstein64/tic-tac-toe/lib";

import { EventEmitter } from "node:events";
import { Elysia, t } from "elysia";
import { Board } from "@goldenstein64/tic-tac-toe/lib";
import html, { Html } from "@elysiajs/html";
import { eq, max, sql } from "drizzle-orm";

import { db } from "../db";
import { intString } from "../types";
import { Move } from "../db/schema";
import { GameButton } from "../components/game";

const selectMaxOrdering = db
  .select({ ordering: max(Move.ordering) })
  .from(Move)
  .where(eq(Move.lobbyId, sql.placeholder("lobbyId")))
  .prepare();

const insertMove = db
  .insert(Move)
  .values({
    lobbyId: sql.placeholder("lobbyId"),
    ordering: sql.placeholder("ordering"),
    position: sql.placeholder("position"),
  })
  .prepare();

type GameEventEmitter = EventEmitter<{
  [evt: string]: [[ordering: number, position: number]];
}>;

type GameState = {
  event: GameEventEmitter;
  board: Board;
};

const gameStates = new Map<number, GameState>();
function getGameState(gameId: number): GameState {
  let state = gameStates.get(gameId);
  if (state === undefined) {
    state = {
      event: new EventEmitter(),
      board: new Board(),
    };
    gameStates.set(gameId, state);
  }
  return state;
}

function orderingToMark(ordering: number): Mark {
  return ordering % 2 === 1 ? "X" : "O";
}

function waitForMessageEvent(
  emitter: GameEventEmitter,
  evt: string
): Promise<[number, number]> {
  return new Promise((resolve) => emitter.once(evt, resolve));
}

export default new Elysia({ prefix: "/api" })
  .use(html())
  .post(
    "/game-move",
    async function addMove({ body: { id: lobbyId, position }, set }) {
      const result = selectMaxOrdering.get({ lobbyId });
      const ordering = (result?.ordering ?? 0) + 1;

      insertMove.run({ lobbyId, ordering, position });
      const { board, event } = getGameState(lobbyId);
      const mark = orderingToMark(ordering);
      board.setMark(position - 1, mark);
      event.emit("message", [ordering, position]);

      set.headers["Content-Type"] = "text/html";
      return (
        <GameButton disabled lobbyId={lobbyId} position={position}>
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
      const { id: lobbyId } = query;
      set.headers["X-Accel-Buffering"] = "no";
      set.headers["Cache-Control"] = "no-cache";
      set.headers["Content-Type"] = "text/event-stream";

      const { board, event } = getGameState(lobbyId);

      while (true) {
        const [ordering, position] = await waitForMessageEvent(
          event,
          "message"
        );
        const mark = orderingToMark(ordering);
        yield `event: pos-${position}\n`;
        yield `data: ${await (
          <GameButton disabled={false} lobbyId={lobbyId} position={position}>
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
