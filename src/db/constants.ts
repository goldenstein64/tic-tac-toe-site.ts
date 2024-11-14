import { sql } from "drizzle-orm";

export const UNIX_EPOCH = sql<number>`(unixepoch())`;
