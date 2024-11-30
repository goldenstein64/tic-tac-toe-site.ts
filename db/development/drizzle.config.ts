import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./db/development/drizzle",
  dbCredentials: {
    url: "file:./db/development/game.db",
  },
});
