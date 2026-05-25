import type { Mark } from "@goldenstein64/tic-tac-toe";

export class NotComputerError extends Error {
  name = "NotComputerError";

  constructor(
    readonly mark: Mark,
    playerId: number,
  ) {
    super(`${mark} (${playerId}) is not a computer!`);
    this.mark = mark;
  }
}
