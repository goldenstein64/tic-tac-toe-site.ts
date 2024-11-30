import { Board, Mark } from "@goldenstein64/tic-tac-toe/lib";
import {
  EasyComputer,
  HardComputer,
  MediumComputer,
  Player,
} from "@goldenstein64/tic-tac-toe/lib/player";

export const idToComputerFactory = new Map<number, () => Player>()
  .set(1, () => new EasyComputer())
  .set(2, () => new MediumComputer())
  .set(3, () => new HardComputer());

export type ComputerId = 1 | 2 | 3;

export function orderingToMark(ordering: number): Mark {
  return ordering % 2 === 0 ? "X" : "O";
}

export class NotComputerError extends Error {
  constructor(
    readonly mark: Mark,
    playerId: number
  ) {
    super(`${mark} (${playerId}) is not a computer!`);
    this.mark = mark;
  }
}

export default async function (
  playerX: ComputerId,
  playerO: ComputerId
): Promise<[number[], Mark | null]> {
  const computerFactoryX = idToComputerFactory.get(playerX);
  if (computerFactoryX === undefined) {
    throw new NotComputerError("X", playerX);
  }
  const computerFactoryO = idToComputerFactory.get(playerO);
  if (computerFactoryO === undefined) {
    throw new NotComputerError("O", playerO);
  }

  const players: [Player, Player] = [computerFactoryX(), computerFactoryO()];
  const marks: [Mark, Mark] = ["X", "O"];
  const board = new Board();
  const moves: number[] = [];
  let currentIndex: 0 | 1 = 0;
  while (!board.full()) {
    const currentPlayer = players[currentIndex];
    const currentMark = marks[currentIndex];
    const move = await currentPlayer.getMove(board, currentMark);
    moves.push(move);
    board.setMark(move, currentMark);
    if (board.won(currentMark)) {
      return [moves, currentMark];
    }
    currentIndex = currentIndex === 0 ? 1 : 0;
  }

  return [moves, null];
}
