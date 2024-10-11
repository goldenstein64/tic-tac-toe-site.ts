import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { sql } from "drizzle-orm";

import * as schema from "./schema";

const bunDB = new Database("game.db");

export const db = drizzle(bunDB, { schema });
db.run(sql`PRAGMA journal_mode = WAL;`);
db.run(sql`PRAGMA synchronous = NORMAL;`);
