import { Elysia, t } from "elysia";

import { db } from "../libs/db";

const insertGame = db.query<{}, []>(`
  INSERT INTO Game (playerX, playerO) VALUES ($playerX, $playerO)
`);

const playerType = t.Union([
  t.Literal("human"),
  t.Literal("easyComputer"),
  t.Literal("mediumComputer"),
  t.Literal("hardComputer"),
]);

export default new Elysia({ prefix: "/api" })
  .post("/new-game", ({ body, set }) => {}, {
    body: t.Object({
      typeX: playerType,
      typeO: playerType,
    }),
    type: "application/x-www-form-urlencoded",
  })
  .get("/active-games", (ctx) => {}, {})
  .get("/available-games", (ctx) => {}, {});
