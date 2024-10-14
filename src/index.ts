import { Elysia, t } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import html from "@elysiajs/html";

import { GameHtml } from "./components/game";
import { GameListHtml } from "./components/game-list";

import gameApi from "./routes/game-api";
import lobbyApi from "./routes/lobby-api";
import userApi from "./routes/user-api";

const app = new Elysia()
  .use(html())
  .use(gameApi)
  .use(lobbyApi)
  .use(userApi)
  .get("/", () => GameListHtml({ userId: 4 }))
  .get(
    "/game",
    ({ query: { id: gameId } }) => {
      return GameHtml({ gameId, userId: 4 });
    },
    { query: t.Object({ id: t.Number() }) }
  )
  .use(staticPlugin({ assets: "public", prefix: "/" }))
  .listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
