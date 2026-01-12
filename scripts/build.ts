const NODE_ENV = process.env.NODE_ENV;

await Bun.$`rm -rf public/client`;

await Bun.build({
  entrypoints: [
    "client/game.ts",
    "client/lobby.ts",
    "client/login.ts",
    "client/new-lobby.ts",
  ],
  outdir: "public/client",
  splitting: true,
  target: "browser",
  format: "esm",
  minify: NODE_ENV === "production",
  sourcemap: "linked",
});

export {};
