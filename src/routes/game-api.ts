import type { Emitter, EventType } from "mitt";
import type { Mark } from "@goldenstein64/tic-tac-toe/lib";

import { Elysia, t } from "elysia";
import mitt from "mitt";
import { Board } from "@goldenstein64/tic-tac-toe/lib";

import { db } from "../libs/db";
import { intString } from "../types";

const selectNextOrdering = db.query<
  { newOrdering: number },
  [{ gameId: number }]
>(`
  SELECT max(ordering) + 1 AS newOrdering
    FROM Move
    WHERE gameId = $gameId;
`);

const insertMove = db.query<
  never,
  [{ gameId: number; ordering: number; position: number }]
>(`
  INSERT INTO Move (gameId, ordering, position)
    VALUES ($gameId, $ordering, $position);
`);

const selectAllMoves = db.query<
  { ordering: number; position: number },
  [{ gameId: number }]
>(`
  SELECT ordering, position
    FROM Move
    WHERE gameId = $gameId
    ORDER BY ordering;
`);

type GameState = {
  event: Emitter<{ message: [number, number] }>;
  board: Board;
};

const gameEvents = new Map<number, GameState>();
function getGameEvent(gameId: number): GameState {
  let state = gameEvents.get(gameId);
  if (state === undefined) {
    state = {
      event: mitt(),
      board: new Board(),
    };
    gameEvents.set(gameId, state);
  }
  return state;
}

function getMark(ordering: number): Mark {
  return ordering % 2 === 1 ? "X" : "O";
}

function renderButton(args: {
  disabled: boolean;
  gameId: number;
  position: number;
  mark?: Mark;
}): string {
  const { disabled: closed, gameId, position, mark = "" } = args;
  return `<button
          class="game-button"
          type="button"
          sse-swap="pos-${position}"
          hx-swap="outerHTML"
          hx-put="/api/game-move"
          hx-vals='{"id": ${gameId}, "position": ${position} }'
          disabled="${closed}"
        >${mark}</button>`;
}

function renderClosedButton(mark?: Mark): string {
  return `<button class="game-button" type="button" disabled>${
    mark ?? ""
  }</button>`;
}

function waitForEvent<K extends Record<EventType, unknown>>(
  emitter: Emitter<K>,
  type: keyof K
): Promise<K[keyof K]> {
  return new Promise((resolve, reject) => {
    function listener(args: K[keyof K]): void {
      resolve(args);
      emitter.off(type, listener);
    }
    emitter.on(type, listener);
  });
}

export default new Elysia({ prefix: "/api" })
  .put(
    "/game-move",
    function addMove({ body, set }) {
      const { id: gameId, position } = body;
      const ordering = selectNextOrdering.get({ gameId })?.newOrdering ?? 1;

      insertMove.run({ gameId, ordering, position });
      const { board, event } = getGameEvent(gameId);
      const mark = getMark(ordering);
      board.data[position - 1] = mark;
      event.emit("message", [ordering, position]);

      set.headers["content-type"] = "text/html";
      return renderButton({
        disabled: true,
        gameId,
        position,
        mark,
      });
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
      set.headers["x-accel-buffering"] = "no";
      set.headers["cache-control"] = "no-cache";
      set.headers["content-type"] = "text/event-stream";

      const { board, event } = getGameEvent(gameId);
      {
        const moves = selectAllMoves.all({ gameId });
        let orderMap = new Map<number, number>(
          moves.map(({ ordering, position }) => [position, ordering])
        );
        for (let i = 0; i < 9; i++) {
          const position = i + 1;
          const ordering = orderMap.get(position);
          if (ordering) {
            const mark = getMark(ordering);
            board.data[i] = mark;
            yield `event: pos-${position}\n`;
            yield `data: ${renderButton({
              disabled: true,
              gameId,
              position,
              mark,
            })}\n\n`;
          }
        }
      }

      while (true) {
        const [ordering, position] = await waitForEvent(event, "message");
        const mark = getMark(ordering);
        yield `event: pos-${position}\n`;
        yield `data: ${renderButton({
          disabled: true,
          gameId,
          position,
          mark,
        })}\n\n`;

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
