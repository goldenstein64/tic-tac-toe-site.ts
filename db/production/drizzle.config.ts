import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./db/production/drizzle",
  dbCredentials: {
    url: "file:./db/production/game.db",
  },
});
