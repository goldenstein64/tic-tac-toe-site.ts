import type { Mark } from "@goldenstein64/tic-tac-toe";

import { EventEmitter, on } from "node:events";
import { Elysia, error, t } from "elysia";
import { Board } from "@goldenstein64/tic-tac-toe";
import { Player } from "@goldenstein64/tic-tac-toe/player";
import html, { Html } from "@elysiajs/html";
import { eq, max, sql } from "drizzle-orm";
import { setTimeout as delay } from "timers/promises";

import { db, typePrepared } from "../db";
import { FinishedLobby, Game, Lobby, Move } from "../db/schema";
import jwtAuth from "../libs/jwt-auth";
import { idToComputerFactory, orderingToMark } from "../libs/run-game";
import { intString } from "../types";
import { GameRows } from "../components/game-active";
import { LobbyStatus } from "../db/datatypes";

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

function updateLobbyStatus({
  id,
  status,
}: {
  id: number;
  status: LobbyStatus;
}) {
  db.update(Lobby).set({ status: status }).where(eq(Lobby.id, id)).run();
}

const insertFinishedLobby = typePrepared(
  db
    .insert(FinishedLobby)
    .values({ id: sql.placeholder("id"), winner: sql.placeholder("winner") })
    .prepare(),
  _placeholders as { lobbyId: number; winner?: number }
);

type GameStateInitialEvents = {
  "new-move": [ordering: number];
  end: [winner: Mark | undefined];
};
const events = ["new-move", "end"] as const;

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

    this.once("end", () => this.removeAllListeners());

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
      state.once("end", () => this.delete(lobbyId));
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

type MoveStreamContext = {
  board: Board;
  userIsX: boolean;
  isClientPlaying: boolean;
  lobbyId: number;
  state: GameState;
};

async function* onNewMove(
  { board, userIsX, isClientPlaying, lobbyId, state }: MoveStreamContext,
  ordering: number
): AsyncGenerator<string> {
  const mark = orderingToMark(ordering);

  // update the board
  const endResult = board.ended(mark);
  if (endResult) {
    state.emit("end", endResult.winner);
    return;
  }

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

async function* onEnded(
  { board, lobbyId }: MoveStreamContext,
  winnerMark: Mark | undefined
): AsyncGenerator<string> {
  updateLobbyStatus({ id: lobbyId, status: "finished" });
  const players = selectGamePlayers.get({ lobbyId })!;
  insertFinishedLobby.run({
    lobbyId,
    winner:
      winnerMark == "X" ? players.playerX
      : winnerMark == "O" ? players.playerO
      : undefined,
  });
  yield event({
    event: "board",
    data: await (<GameRows lobbyId={lobbyId} board={board} disabled />),
  });
  yield event({ event: "winner", data: winnerMark ?? "no one" });
  yield event({ event: "status", data: "finished" });
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
      body: t.Object({ id: intString, position: intString }),
      parse: "application/x-www-form-urlencoded",
    }
  )
  .state("abortController", undefined as undefined | AbortController)
  .get(
    "/game-move",
    async function* ({
      query: { id: lobbyId },
      user: { id: userId },
      set,
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
      const moveStreamCtx: MoveStreamContext = {
        state,
        board,
        userIsX,
        isClientPlaying,
        lobbyId,
      };
      const onMoveStream = on(state, "move-stream", {
        signal: abortController.signal,
      }) as AsyncIterable<GameStateEvents["move-stream"]>;
      moveStream: for await (const [name, args] of onMoveStream) {
        console.log(name);
        switch (name) {
          case "new-move":
            yield* onNewMove(moveStreamCtx, ...args);
            break;
          case "end":
            yield* onEnded(moveStreamCtx, ...args);
            break moveStream;
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
