import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { sql, TransactionRollbackError } from "drizzle-orm";

import * as schema from "./schema";

const bunDB = new Database("game.db");

export const db = drizzle(bunDB, { schema });
db.run(sql`PRAGMA journal_mode = WAL;`);
db.run(sql`PRAGMA synchronous = NORMAL;`);

export type Transaction = {
  readonly db: typeof db; // This type is the return type of `drizzle`
  readonly nestedIndex: number;
  readonly savepointName: string;
  transaction: <T>(tx: (t: Transaction) => Promise<T>) => Promise<T>;
  rollback: () => void;
};

function createTransaction(
  nestedIndex?: number,
  savepointName?: string
): Transaction {
  const idx = nestedIndex ?? 0;
  const name = savepointName ?? "sp0";

  return {
    db,
    nestedIndex: idx,
    savepointName: name,
    transaction: async (tx) => {
      db.run(sql.raw(`savepoint ${name}`));
      const t = createTransaction(idx + 1, `sp${idx + 1}`);

      try {
        const txResult = await tx(t);
        db.run(sql.raw(`release savepoint ${name}`));
        return txResult;
      } catch (e) {
        db.run(sql.raw(`rollback to savepoint ${name}`));
        throw e;
      }
    },
    rollback: () => {
      throw new TransactionRollbackError();
    },
  };
}

export const tx = createTransaction();
