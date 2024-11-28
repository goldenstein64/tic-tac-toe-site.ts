import { $ } from "bun";
import path from "node:path";

export type DataConfig = { quiet?: boolean };

const dbFolder = process.argv[2] ?? ".";
const dbPath = path.resolve(dbFolder, "game.db");
const drizzleConfig = path.resolve(dbFolder, "drizzle.config.ts");
const initialData = Bun.file(path.resolve(dbFolder, "game.db-data.ts"));

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

if (await initialData.exists()) {
  console.log("writing initial data...");
  const loader = (await import(initialData.name!)).default as (
    dbPath: string
  ) => Promise<void>;
  await loader(dbPath);
}

console.log("done :)");
