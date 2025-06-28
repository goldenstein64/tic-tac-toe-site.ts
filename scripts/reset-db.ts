import { $ } from "bun";
import path from "node:path";
import { parseArgs } from "node:util";

export type DataConfig = { quiet?: boolean };

const { values } = parseArgs({
  args: process.argv,
  strict: true,
  allowPositionals: true,
  options: {
    force: {
      type: "boolean",
      short: "f",
      default: false,
    },
  },
});
const { force: forceArg = false } = values;

const environment = Bun.env.NODE_ENV;
if (environment === undefined) {
  throw new Error("NODE_ENV is undefined!");
}
const dbPath = path.resolve("db", environment, "game.db");
const drizzleConfig = path.resolve("db", environment, "drizzle.config.ts");

const initialData = Bun.file(
  path.resolve("db", environment, "game.db-data.ts")
);

const productionDbPath = path.resolve("./db/production/game.db");
if (dbPath === productionDbPath && !forceArg) {
  console.warn(
    "This will reset ALL data in the production database. Run the command again with '--force' flag to confirm."
  );
  process.exit(1);
}

console.log(`deleting ${dbPath}...`);
{
  const results = await Promise.allSettled([
    $`rm ${dbPath}`,
    $`rm ${dbPath}-shm`,
    $`rm ${dbPath}-wal`,
  ]);
  if (results.some(({ status }) => status === "rejected")) {
    console.warn("some files couldn't be deleted!");
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
