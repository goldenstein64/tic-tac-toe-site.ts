import type { Connection, Mark, Message } from "@goldenstein64/tic-tac-toe";
import type { Player } from "@goldenstein64/tic-tac-toe/player";
import Application, {
  EasyComputer,
  HardComputer,
  MediumComputer,
} from "@goldenstein64/tic-tac-toe";

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

class SilentConnection implements Connection {
  print(_: Message): Promise<void> {
    return Promise.resolve();
  }
  prompt(_: Message): Promise<string> {
    throw new Error("prompt not expected");
  }
}

type RunResult = Readonly<{ moves: number[]; winner: Mark | null }>;

export default async function (
  playerX: ComputerId,
  playerO: ComputerId
): Promise<RunResult> {
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
  const app = new Application(new SilentConnection());
  const moves: number[] = [];
  let currentIndex: 0 | 1 = 0;
  while (true) {
    const endedResult = await app.playTurn(
      players[currentIndex],
      marks[currentIndex]
    );
    if (endedResult) {
      return { moves, ...endedResult };
    }
    currentIndex = currentIndex === 0 ? 1 : 0;
  }
}
