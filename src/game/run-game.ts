import type { Mark } from "@goldenstein64/tic-tac-toe";
import type { Player } from "@goldenstein64/tic-tac-toe/player";
import {
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

export type RunResult = Readonly<{ moves: number[]; winner: Mark | null }>;

export type WorkerInput = {
  id: string;
  playerX: ComputerId;
  playerO: ComputerId;
};

export type WorkerOutput = { id: string } & (
  | RunResult
  | { error: string | { name: string; message: string } }
);

const worker = new Worker("./src/game/run-game-worker.ts");

const jobs = new Map<
  string,
  { resolve: (value: RunResult) => void; reject: (value: any) => void }
>();
worker.addEventListener("message", (evt: MessageEvent<WorkerOutput>) => {
  const { id, ...runResult } = evt.data;
  const resolvers = jobs.get(id);
  if (resolvers === undefined) {
    throw new Error(`could not find resolver for id ${id}`);
  }

  if ("error" in runResult) {
    resolvers.reject(runResult.error);
  } else {
    resolvers.resolve(runResult);
  }
});

worker.addEventListener("messageerror", (evt) => console.error(evt));

export default async function (
  playerX: ComputerId,
  playerO: ComputerId,
): Promise<RunResult> {
  const id = Bun.randomUUIDv7();
  const messageData: WorkerInput = { id, playerX, playerO };
  const { promise, resolve, reject } = Promise.withResolvers<RunResult>();
  jobs.set(id, { resolve, reject });

  worker.postMessage(messageData);
  return promise;
}
