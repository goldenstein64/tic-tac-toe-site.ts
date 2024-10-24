Bun.build({
  entrypoints: ["client/username-modal.ts"],
  minify: false,
  outdir: "public/out",
  external: ["htmx.org"],
});
