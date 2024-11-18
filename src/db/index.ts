import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { sql } from "drizzle-orm";

import * as schema from "./schema";

const bunDB = new Database("game.db");

export const db = drizzle(bunDB, { schema });
db.run(sql`PRAGMA journal_mode = WAL;`);
db.run(sql`PRAGMA synchronous = NORMAL;`);

type tx = <T>(callback: (tx: tx) => Promise<T>) => Promise<T>;

async function transaction<T>(
  callback: (t: tx) => Promise<T>,
  idx: number
): Promise<T> {
  const savepointName = `sp${idx}`;

  db.run(sql.raw(`savepoint ${savepointName}`));
  try {
    const txResult = await callback((cb) => transaction(cb, idx + 1));
    db.run(sql.raw(`release savepoint ${savepointName}`));
    return txResult;
  } catch (e) {
    db.run(sql.raw(`rollback to savepoint ${savepointName}`));
    throw e;
  }
}

export const tx: tx = (cb) => transaction(cb, 0);
