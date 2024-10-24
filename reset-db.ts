import Database from "bun:sqlite";
import * as schema from "./src/db/schema";
import fs from "fs/promises";
import { drizzle } from "drizzle-orm/bun-sqlite";

const { IsComputer, User } = schema;

console.log("deleting db...");
{
  const results = await Promise.allSettled([
    fs.rm("game.db"),
    fs.rm("game.db-shm"),
    fs.rm("game.db-wal"),
  ]);
  if (results.some(({ status }) => status === "rejected")) {
    console.log("some files couldn't be deleted!");
  }
}

console.log("generating db...");
Bun.spawnSync({ cmd: ["drizzle-kit", "push"], stdout: "inherit" });

console.log("writing initial data...");
const db = drizzle(new Database("game.db"), { schema });

const easyCreated = new Date(Date.UTC(2024, 3, 5, 20, 47)); // 2024/3/5 20:47
const mediumCreated = new Date(Date.UTC(2023, 8, 4, 17, 35)); // 2023/8/4 17:35
const hardCreated = new Date(Date.UTC(2023, 8, 6, 20, 23)); // 2023/8/6 20:23

const insertComputerUsers = db
  .insert(User)
  .values([
    { id: 1, username: "EasyComputer", createdAt: easyCreated },
    { id: 2, username: "MediumComputer", createdAt: mediumCreated },
    { id: 3, username: "HardComputer", createdAt: hardCreated },
  ])
  .onConflictDoNothing();

console.log(insertComputerUsers.toSQL());
await insertComputerUsers;

const insertComputerSet = db
  .insert(IsComputer)
  .values([{ userId: 1 }, { userId: 2 }, { userId: 3 }])
  .onConflictDoNothing();

console.log(insertComputerSet.toSQL());
await insertComputerSet;

console.log("done :)");
