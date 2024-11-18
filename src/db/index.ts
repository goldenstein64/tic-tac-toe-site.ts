import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { sql, TransactionRollbackError } from "drizzle-orm";

import * as schema from "./schema";

const bunDB = new Database("game.db");

export const db = drizzle(bunDB, { schema });
db.run(sql`PRAGMA journal_mode = WAL;`);
db.run(sql`PRAGMA synchronous = NORMAL;`);

class Transaction {
  readonly savepointName: string;

  constructor(readonly nestedIndex: number = 0) {
    this.savepointName = `sp${nestedIndex}`;
  }

  async transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
    db.run(sql.raw(`savepoint ${this.savepointName}`));
    const tx = new Transaction(this.nestedIndex + 1);

    try {
      const txResult = await callback(tx);
      db.run(sql.raw(`release savepoint ${this.savepointName}`));
      return txResult;
    } catch (e) {
      db.run(sql.raw(`rollback to savepoint ${this.savepointName}`));
      throw e;
    }
  }

  rollback() {
    throw new TransactionRollbackError();
  }
}

export const tx = new Transaction();
