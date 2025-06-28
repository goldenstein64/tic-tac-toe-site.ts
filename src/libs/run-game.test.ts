import { describe, expect, it } from "bun:test";
import { Type as t } from "@sinclair/typebox";
import { Check } from "@sinclair/typebox/value";

import runGame, { NotComputerError } from "./run-game";
import { BOARD_SIZE } from "@goldenstein64/tic-tac-toe/data/Board";

describe("run-game", () => {
  it("errors if either mark is not a computer", async () => {
    expect(runGame(-1 as any, 1)).rejects.toStrictEqual(
      new NotComputerError("X", -1)
    );
    expect(runGame(-1 as any, -1 as any)).rejects.toStrictEqual(
      new NotComputerError("X", -1)
    );
    expect(runGame(1, -10 as any)).rejects.toStrictEqual(
      new NotComputerError("O", -10)
    );
  });

  it("does not throw if both marks are a computer", async () => {
    const resultType = t.Object({
      moves: t.Array(t.Integer({ minimum: 0, maximum: BOARD_SIZE - 1 })),
      winner: t.Union([t.Literal("X"), t.Literal("O"), t.Null()]),
    });
    for (let i = 0; i < 50; i++) {
      const result = await runGame(1, 1);
      expect(Check(resultType, result)).toBeTrue();
    }
  });
});
