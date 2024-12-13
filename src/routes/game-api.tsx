import type { Mark } from "@goldenstein64/tic-tac-toe";

import { EventEmitter, on } from "node:events";
import { Elysia, error, t } from "elysia";
import { Board } from "@goldenstein64/tic-tac-toe";
import { Player } from "@goldenstein64/tic-tac-toe/player";
import html, { Html } from "@elysiajs/html";
import { eq, max, sql } from "drizzle-orm";
import { setTimeout as delay } from "timers/promises";

import { db, typePrepared } from "../db";
import { Game, Move } from "../db/schema";
import jwtAuth from "../libs/jwt-auth";
import { idToComputerFactory, orderingToMark } from "../libs/run-game";
import { intString } from "../types";
import { GameRows } from "../components/game-active";

const _placeholders: any = undefined;

const selectMaxOrdering = typePrepared(
  db
    .select({ ordering: max(Move.ordering) })
    .from(Move)
    .where(eq(Move.lobbyId, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number }
);

const insertMove = typePrepared(
  db
    .insert(Move)
    .values({
      lobbyId: sql.placeholder("lobbyId"),
      ordering: sql.placeholder("ordering"),
      position: sql.placeholder("position"),
    })
    .prepare(),
  _placeholders as { lobbyId: number; ordering: number; position: number }
);

const selectMoves = typePrepared(
  db
    .select({ ordering: Move.ordering, position: Move.position })
    .from(Move)
    .where(eq(Move.lobbyId, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number }
);

const selectGamePlayers = typePrepared(
  db
    .select({ playerX: Game.playerX, playerO: Game.playerO })
    .from(Game)
    .where(eq(Game.lobbyId, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number }
);

type GameStateInitialEvents = {
  "new-move": [ordering: number];
  ended: [winner: Mark | undefined];
};
const events = ["new-move", "ended"] as const;

type GameStateEvents = GameStateInitialEvents & {
  "move-stream": {
    [K in keyof GameStateInitialEvents]: [evt: K, GameStateInitialEvents[K]];
  }[keyof GameStateInitialEvents];
};

export class GameState extends EventEmitter<GameStateEvents> {
  readonly board: Board = new Board();
  readonly computers: Map<Mark, Player | undefined> = new Map();

  constructor(
    readonly lobbyId: number,
    playerX: number,
    playerO: number
  ) {
    super();
    const computerXFactory = idToComputerFactory.get(playerX);
    if (computerXFactory) {
      this.computers.set("X", computerXFactory());
    }

    const computerOFactory = idToComputerFactory.get(playerO);
    if (computerOFactory) {
      this.computers.set("O", computerOFactory());
    }

    for (const { position, ordering } of selectMoves.all({ lobbyId })) {
      const mark = orderingToMark(ordering);
      this.board.setMark(position, mark);
    }

    for (const evt of events)
      this.on(evt, (...args: any) => this.emit("move-stream", evt, args));

    this.once("ended", () => this.removeAllListeners());

    this.on("new-move", async (ordering) => {
      const nextTurn = orderingToMark(ordering + 1);
      const nextComputer = this.computers.get(nextTurn);
      if (!nextComputer) return;

      const thisTurn = orderingToMark(ordering);
      if (this.board.ended(thisTurn)) return;

      // this is not a race, we want the computer to return its move after a
      // minimum of one second
      const [position] = await Promise.all([
        nextComputer.getMove(this.board, nextTurn),
        delay(1000),
      ]);
      this.board.setMark(position, nextTurn);
      insertMove.run({ lobbyId, ordering: ordering + 1, position });
      this.emit("new-move", ordering + 1);
    });
  }
}

class GameStates extends Map<number, GameState> {
  getOrCreate(lobbyId: number, playerX: number, playerO: number): GameState {
    let state = this.get(lobbyId);
    if (!state) {
      state = new GameState(lobbyId, playerX, playerO);
      state.once("ended", () => this.delete(lobbyId));
      this.set(lobbyId, state);
    }
    return state;
  }
}

export const gameStates = new GameStates();

type EventProps = { event?: string; data: string };
function event({ event = "message", data }: EventProps): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

export default new Elysia({ prefix: "/api" })
  .use(html())
  .use(jwtAuth())
  .resolve(({ user }) => ({ user: user! }))
  .post(
    "/game-move",
    ({ body: { id: lobbyId, position }, user: { id: userId } }) => {
      const players = selectGamePlayers.get({ lobbyId });
      if (!players) return error("Not Found");
      const { playerX, playerO } = players;
      if (playerX !== userId && playerO !== userId)
        return error("Unauthorized");

      const state = gameStates.getOrCreate(lobbyId, playerX, playerO);
      if (!state.board.canMark(position)) return error("Unauthorized");

      const maxOrderResult = selectMaxOrdering.get({ lobbyId });
      const ordering = (maxOrderResult?.ordering ?? -1) + 1;
      const mark = orderingToMark(ordering);
      state.board.setMark(position, mark);
      insertMove.run({ lobbyId, ordering, position });
      state.emit("new-move", ordering);
    },
    {
      body: t.Object({
        id: intString,
        position: intString,
      }),
      type: "application/x-www-form-urlencoded",
    }
  )
  .state("abortController", undefined as undefined | AbortController)
  .get(
    "/game-move",
    async function* ({
      query: { id: lobbyId },
      set,
      user: { id: userId },
      store,
    }) {
      const players = selectGamePlayers.get({ lobbyId });
      if (!players) return error("Not Found");

      set.headers["X-Accel-Buffering"] = "no";
      set.headers["Cache-Control"] = "no-cache";
      set.headers["Content-Type"] = "text/event-stream";

      const { playerX, playerO } = players;
      const state = gameStates.getOrCreate(lobbyId, playerX, playerO);
      const board = state.board;
      const userIsX = userId === playerX;
      const userIsO = userId === playerO;
      const isClientPlaying = userIsX || userIsO;

      const abortController = new AbortController();
      store.abortController = abortController;
      const onMoveStream = on(state, "move-stream", {
        signal: abortController.signal,
      }) as AsyncIterableIterator<GameStateEvents["move-stream"]>;
      for await (const [name, args] of onMoveStream) {
        // would be more troublesome as a switch btw
        if (name === "new-move") {
          const [ordering] = args;
          const mark = orderingToMark(ordering);

          // update the board
          const endResult = board.ended(mark);
          if (endResult) {
            yield event({
              event: "board",
              data: await (
                <GameRows lobbyId={lobbyId} board={board} disabled />
              ),
            });
            yield event({
              event: "winner",
              data: endResult.winner ?? "no one",
            });
            state.emit("ended", endResult.winner);
          } else {
            const nextTurn = orderingToMark(ordering + 1);
            const isClientsTurn = userIsX === (nextTurn === "X");
            const disabled = !isClientPlaying || !isClientsTurn;
            yield event({
              event: "board",
              data: await (
                <GameRows lobbyId={lobbyId} board={board} disabled={disabled} />
              ),
            });
          }
        } else if (name === "ended") {
          const [winnerMark] = args;
          event({
            event: "board",
            data: await (<GameRows lobbyId={lobbyId} board={board} disabled />),
          });
          yield event({ event: "winner", data: winnerMark ?? "no one" });
          break;
        }
      }
    },
    {
      query: t.Object({ id: intString }),
      afterHandle({ store }) {
        store.abortController?.abort("aborted for await loop");
      },
    }
  );
