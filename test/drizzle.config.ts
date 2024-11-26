import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./test/drizzle",
  dbCredentials: {
    url: "file:./test/game.db",
  },
});
