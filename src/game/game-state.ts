import { type Mark, Board } from "@goldenstein64/tic-tac-toe";
import { Player } from "@goldenstein64/tic-tac-toe/player";
import { EventEmitter } from "events";
import { setTimeout as delay } from "timers/promises";

import { idToComputerFactory, orderingToMark } from "./run-game";
import {
  selectMoves,
  selectPlayersInGame,
  updateLobbyStatus,
  insertFinishedLobby,
  insertMove,
} from "../db/queries";

type GameStateInitialEvents = {
  "new-move": [ordering: number];
  end: [winner: Mark | null];
  sleep: [];
};

const MINUTES = 60 * 1000;

const events = ["new-move", "end", "sleep"] as const;
export type GameStateEvents = GameStateInitialEvents & {
  "move-stream": {
    [K in keyof GameStateInitialEvents]: [evt: K, GameStateInitialEvents[K]];
  }[keyof GameStateInitialEvents];
};

export class GameState extends EventEmitter<GameStateEvents> {
  static readonly SLEEP_TIME = 5 * MINUTES;

  sleepTimer: NodeJS.Timeout = this.getSleepTimer();

  readonly board: Board = new Board();
  computerX: Player | undefined = undefined;
  computerO: Player | undefined = undefined;

  constructor(readonly lobbyId: number) {
    super();

    const players = selectPlayersInGame.get({ lobbyId });
    if (players === undefined)
      throw new Error("lobby does not have an active game");
    const { playerX, playerO } = players;

    this.computerX = idToComputerFactory.get(playerX)?.();
    this.computerO = idToComputerFactory.get(playerO)?.();

    for (const { position, ordering } of selectMoves.all({ lobbyId })) {
      const mark = orderingToMark(ordering);
      this.board.setMark(position, mark);
    }

    for (const evt of events) {
      this.on(evt, (...args: any) => this.emit("move-stream", evt, args));
    }

    this.once("end", (winnerMark) => {
      const winnerId =
        winnerMark === "X" ? playerX
        : winnerMark === "O" ? playerO
        : undefined;
      updateLobbyStatus({
        lobbyId,
        fromStatus: "active",
        toStatus: "finished",
      });
      insertFinishedLobby.run({
        lobbyId,
        winner: winnerId,
      });

      this.removeAllListeners();
      clearTimeout(this.sleepTimer);
    });

    this.on("new-move", async (ordering) => {
      const nextMark = orderingToMark(ordering + 1);
      const nextComputer = nextMark === "X" ? this.computerX : this.computerO;
      if (!nextComputer) return;

      if (this.ended(ordering)) return;

      // pretend the computer is "thinking"
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

  getSleepTimer(): NodeJS.Timeout {
    return setTimeout(() => this.emit("sleep"), GameState.SLEEP_TIME);
  }

  resetSleep() {
    clearTimeout(this.sleepTimer);
    this.sleepTimer = this.getSleepTimer();
  }
}

class GameStates extends Map<number, GameState> {
  getOrCreate(lobbyId: number): GameState {
    let state = this.get(lobbyId);
    if (!state) {
      state = new GameState(lobbyId);
      state.once("end", () => this.delete(lobbyId));
      state.once("sleep", () => this.delete(lobbyId));
      this.set(lobbyId, state);
    }
    return state;
  }
}

export const gameStates = new GameStates();
