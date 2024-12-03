import { $ } from "bun";
import path from "node:path";
import { parseArgs } from "node:util";

export type DataConfig = { quiet?: boolean };

const { values, positionals } = parseArgs({
  args: process.argv,
  strict: true,
  allowPositionals: true,
  options: {
    confirm: {
      type: "boolean",
      default: false,
    },
  },
});

if (positionals.length > 3)
  throw new EvalError(`expected at most 1 argument, got ${positionals.length}`);
const [_bun, _script, environment = "development"] = positionals;
const { confirm: confirmArg = false } = values;

Bun.env.NODE_ENV = environment;
const dbPath = path.resolve("db", environment, "game.db");
const drizzleConfig = path.resolve("db", environment, "drizzle.config.ts");

const initialData = Bun.file(
  path.resolve("db", environment, "game.db-data.ts")
);

const productionDbPath = path.resolve("./db/production/game.db");
if (dbPath === productionDbPath && !confirmArg) {
  const choice = confirm(
    "This will reset ALL data in the production database. Are you sure?"
  );
  if (!choice) process.exit(0);
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
