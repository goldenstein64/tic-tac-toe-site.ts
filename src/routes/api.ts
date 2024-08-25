import type { Emitter, EventType } from "mitt";
import type { Mark } from "../libs/board";

import { Elysia, t } from "elysia";
import mitt from "mitt";

import { db } from "../libs/db";
import { Board } from "../libs/board";

type GameEvent = Emitter<{ message: [number, number] }>;

const gameEvents = new Map<number, GameEvent>();
function getGameEvent(gameId: number): GameEvent {
  let emitter = gameEvents.get(gameId);
  if (emitter === undefined) {
    emitter = mitt();
    gameEvents.set(gameId, emitter);
  }
  return emitter;
}

type addMoveParams = { gameId: number; ordering: number; position: number };

const nextOrderingQuery = db.query<
  { newOrdering: number },
  [{ gameId: number }]
>(`
  SELECT max(ordering) + 1 AS newOrdering 
    FROM Move 
    WHERE gameId = $gameId;
`);

const addMoveQuery = db.query<never, [addMoveParams]>(`
  INSERT INTO Move (gameId, ordering, position) 
    VALUES ($gameId, $ordering, $position);
`);

const getAllMovesQuery = db.query<
  { ordering: number; position: number },
  [{ gameId: number }]
>(`
  SELECT ordering, position 
    FROM Move 
    WHERE gameId = $gameId
    ORDER BY ordering;
`);

function getMark(ordering: number): Mark {
  return ordering % 2 === 1 ? "X" : "O";
}

function renderOccupiedButton(mark: Mark): string {
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

const intString = t
  .Transform(t.String())
  .Decode(parseInt)
  .Encode((v) => v.toString());

export default new Elysia({ prefix: "/api" })
  .put(
    "/game-move",
    function addMove({ body, set }) {
      const { id: gameId, position } = body;
      const ordering = nextOrderingQuery.get({ gameId })?.newOrdering ?? 1;

      addMoveQuery.run({ gameId, ordering, position });
      getGameEvent(gameId).emit("message", [ordering, position]);

      set.headers["content-type"] = "text/html";
      return renderOccupiedButton(getMark(ordering));
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

      const board = new Board();
      {
        const moves = getAllMovesQuery.all({ gameId });
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
            yield `data: ${renderOccupiedButton(mark)}\n\n`;
          }
        }
      }

      let emitter = getGameEvent(gameId);

      while (true) {
        const [ordering, position] = await waitForEvent(emitter, "message");
        const mark = getMark(ordering);
        board.data[position - 1] = mark;
        yield `event: pos-${position}\n`;
        yield `data: ${renderOccupiedButton(mark)}\n\n`;

        if (board.won(mark)) {
          yield "event: winner\n";
          yield `data: ${mark}\n\n`;
          break;
        }
      }
    },
    { query: t.Object({ id: intString }) }
  );
