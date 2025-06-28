import { type Mark, Board } from "@goldenstein64/tic-tac-toe";
import { Player } from "@goldenstein64/tic-tac-toe/player";
import { EventEmitter } from "events";
import { setTimeout as delay } from "timers/promises";

import { idToComputerFactory, orderingToMark } from "./run-game";
import {
  selectMoves,
  selectGamePlayers,
  updateLobbyStatus,
  insertFinishedLobby,
  insertMove,
} from "../db/queries";

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

    for (const evt of events) {
      this.on(evt, (...args: any) => this.emit("move-stream", evt, args));
    }

    this.once("end", () => this.removeAllListeners());
    this.once("end", (winnerMark) => {
      const { playerX, playerO } = selectGamePlayers.get({ lobbyId })!;
      const winnerId =
        winnerMark === "X" ? playerX
        : winnerMark === "O" ? playerO
        : undefined;
      updateLobbyStatus({
        id: lobbyId,
        fromStatus: "active",
        toStatus: "finished",
      });
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
