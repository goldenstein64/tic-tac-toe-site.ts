import { Elysia, t } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import html from "@elysiajs/html";

import GameHtml from "./components/game";
import LobbiesHtml from "./components/lobbies";

import gameApi from "./routes/game-api";
import lobbyApi from "./routes/lobby-api";
import userApi from "./routes/user-api";
import { intString } from "./types";

const app = new Elysia()
  .use(html())
  .use(gameApi)
  .use(lobbyApi)
  .use(userApi)
  .get("/", () => LobbiesHtml({ userId: 4 }))
  .get(
    "/game",
    ({ query: { id: lobbyId } }) => {
      return GameHtml({ lobbyId, userId: 4 });
    },
    { query: t.Object({ id: intString }) }
  )
  .get("/create-lobby", () => Bun.file("./public/create-lobby.html"))
  .use(staticPlugin())
  .listen(3000);

export type App = typeof app;

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
