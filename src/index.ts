import { Elysia, t } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import html from "@elysiajs/html";
import gameApi from "./routes/game-api";
import gameListApi from "./routes/game-list-api";
import { GameHtml } from "./components/game";
import { GameListHtml } from "./components/game-list";

const app = new Elysia()
  .use(html())
  .use(gameApi)
  .use(gameListApi)
  .get("/", () => GameListHtml())
  .get(
    "/game",
    ({ query }) => {
      const { id } = query;
      return GameHtml({ gameId: id, userId: 4 });
    },
    { query: t.Object({ id: t.Number() }) }
  )
  .use(staticPlugin({ assets: "public", prefix: "/" }))
  .listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
