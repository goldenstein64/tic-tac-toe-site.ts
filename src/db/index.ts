import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { sql } from "drizzle-orm";

import * as schema from "./schema";
import Elysia from "elysia";

if (Bun.env.NODE_ENV === undefined) {
  throw new Error("NODE_ENV is undefined!");
}
const bunDB = new Database(`./db/${Bun.env.NODE_ENV}/game.db`);

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

type BasePlaceholders = object | undefined | void;

interface PreparedStmt<P extends BasePlaceholders, T> {
  execute(placeholders: P): Promise<T[]>;
  get(placeholders: P): T | undefined;
  all(placeholders: P): T[];
  run(placeholders: P): void;
}

interface PreparedVoidStmt<P extends BasePlaceholders> {
  execute(placeholders: P): Promise<void>;
  run(placeholders: P): void;
}

export function typePrepared<P extends BasePlaceholders, T>(
  stmt: PreparedStmt<Record<string, unknown>, T>,
  _placeholders: P
): PreparedStmt<P, T>;
export function typePrepared<P extends BasePlaceholders>(
  stmt: PreparedVoidStmt<Record<string, unknown>>,
  _placeholders: P
): PreparedVoidStmt<P>;
export function typePrepared<P extends BasePlaceholders, T>(
  stmt:
    | PreparedStmt<Record<string, unknown>, T>
    | PreparedVoidStmt<Record<string, unknown>>,
  _placeholders: P
): PreparedStmt<P, T> | PreparedVoidStmt<P> {
  return stmt as typeof stmt extends PreparedStmt<Record<string, unknown>, T> ?
    PreparedStmt<P, T>
  : PreparedVoidStmt<P>;
}

export const plugin = new Elysia({ name: "Database" })
  .decorate("db", db)
  .decorate("tx", tx);
