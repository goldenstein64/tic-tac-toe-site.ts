import Database from "bun:sqlite";
import * as schema from "../src/db/schema";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { $ } from "bun";
import path from "node:path";

const { IsComputer, User } = schema;

const dbFolder = process.argv[2] ?? ".";
const dbPath = path.resolve(dbFolder, "game.db");
const drizzleConfig = path.resolve(dbFolder, "drizzle.config.ts");

console.log(`deleting ${dbPath}...`);
{
  const results = await Promise.allSettled([
    $`rm ${dbPath}`,
    $`rm ${dbPath}-shm`,
    $`rm ${dbPath}-wal`,
  ]);
  if (results.some(({ status }) => status === "rejected")) {
    console.error("some files couldn't be deleted!");
  }
}

console.log(`generating ${dbPath}...`);
await $`drizzle-kit push --config ${drizzleConfig}`;

console.log("writing initial data...");
const db = drizzle(new Database(dbPath), { schema });

// UTC, 24-hour time
const easyCreated = new Date(Date.UTC(2024, 3 - 1, 6, 1, 47)); // 2024/3/6 1:47
const mediumCreated = new Date(Date.UTC(2023, 8 - 1, 4, 22, 35)); // 2023/8/4 22:35
const hardCreated = new Date(Date.UTC(2023, 7, 8 - 1, 1, 23)); // 2023/8/7 1:23
const debugCreated = new Date(Date.UTC(2024, 11 - 1, 16, 3, 5)); // 2024/11/16 3:05

const refreshKey = 1;
const insertComputerUsers = db.insert(User).values([
  { id: 1, username: "EasyComputer", createdAt: easyCreated, refreshKey },
  { id: 2, username: "MediumComputer", createdAt: mediumCreated, refreshKey },
  { id: 3, username: "HardComputer", createdAt: hardCreated, refreshKey },
  { id: 4, username: "DebugUser", createdAt: debugCreated, refreshKey },
]);

console.log(insertComputerUsers.toSQL());
await insertComputerUsers;

const insertComputerSet = db
  .insert(IsComputer)
  .values([{ userId: 1 }, { userId: 2 }, { userId: 3 }])
  .onConflictDoNothing();

console.log(insertComputerSet.toSQL());
await insertComputerSet;

console.log("done :)");
