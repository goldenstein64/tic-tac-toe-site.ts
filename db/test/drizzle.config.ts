import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./db/test/drizzle",
  dbCredentials: {
    url: "file:./db/test/game.db",
  },
});
