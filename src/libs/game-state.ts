import { type Mark, Board } from "@goldenstein64/tic-tac-toe";
import { Player } from "@goldenstein64/tic-tac-toe/player";
import { EventEmitter } from "events";
import { setTimeout as delay } from "timers/promises";
import { eq, sql } from "drizzle-orm";

import { idToComputerFactory, orderingToMark } from "./run-game";
import { db, typePrepared } from "../db";
import { FinishedLobby, Game, Lobby, Move } from "../db/schema";
import { LobbyStatus } from "../db/datatypes";

const _placeholders: any = undefined;

const selectMoves = typePrepared(
  db
    .select({ ordering: Move.ordering, position: Move.position })
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

const insertFinishedLobby = typePrepared(
  db
    .insert(FinishedLobby)
    .values({
      id: sql.placeholder("lobbyId"),
      winner: sql.placeholder("winner"),
    })
    .prepare(),
  _placeholders as { lobbyId: number; winner?: number }
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

type GameStateInitialEvents = {
  "new-move": [ordering: number];
  end: [winner: Mark | null];
};

const events = ["new-move", "end"] as const;
export type GameStateEvents = GameStateInitialEvents & {
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
    this.once("end", (winnerMark) => {
      const { playerX, playerO } = selectGamePlayers.get({ lobbyId })!;
      const winnerId =
        winnerMark === "X" ? playerX
        : winnerMark === "O" ? playerO
        : undefined;
      updateLobbyStatus({ id: lobbyId, status: "finished" });
      insertFinishedLobby.run({
        lobbyId,
        winner: winnerId,
      });
    });

    this.on("new-move", async (ordering) => {
      const nextMark = orderingToMark(ordering + 1);
      const nextComputer = this.computers.get(nextMark);
      if (!nextComputer) return;

      if (this.ended(ordering)) return;

      // this is not a race, we want the computer to return its move after a
      // minimum of one second
      const [position] = await Promise.all([
        nextComputer.getMove(this.board, nextMark),
        delay(1000),
      ]);
      this.setMark(position, ordering + 1);
    });
  }

  setMark(position: number, ordering: number) {
    const mark = orderingToMark(ordering);
    this.board.setMark(position, mark);
    insertMove.run({ lobbyId: this.lobbyId, ordering, position });
    this.emit("new-move", ordering);
    const ended = this.ended(ordering);
    if (ended) {
      this.emit("end", ended.winner);
    }
  }

  ended(ordering: number): { winner: Mark | null } | undefined {
    const mark = orderingToMark(ordering);
    return this.board.ended(mark);
  }

  canMark(position: number): boolean {
    return this.board.canMark(position);
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
