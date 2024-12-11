import { Table, is } from "drizzle-orm";

import { db } from "#/src/db";
import * as schema from "#/src/db/schema";
import testInitialData from "#/db/test/game.db-data";

// drop everything in the database
for (const table of Object.values(schema)) {
  if (is(table, Table)) {
    db.delete(table).run();
  }
}

await testInitialData({ quiet: true });
