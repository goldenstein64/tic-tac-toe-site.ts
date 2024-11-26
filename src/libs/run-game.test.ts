import { describe, expect, it } from "bun:test";
import { Type as t } from "@sinclair/typebox";
import { Check } from "@sinclair/typebox/value";

import runGame, { NotComputerError } from "./run-game";

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
    const resultType = t.Tuple([
      t.Array(t.Number()),
      t.Union([t.Literal("X"), t.Literal("O"), t.Null()]),
    ]);
    const result = await runGame(1, 1);
    expect(Check(resultType, result)).toBeTrue();
  });
});
