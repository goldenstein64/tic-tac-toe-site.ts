import { Database } from "bun:sqlite";

export const db = new Database("game.db", { strict: true });
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA synchronous = NORMAL;");
