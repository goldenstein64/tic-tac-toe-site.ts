import { parseArgs } from "node:util";

parseArgs({ args: process.argv, strict: true });

Bun.build({
  entrypoints: [],
  minify: false,
  outdir: "public/out",
});
