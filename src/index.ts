import { Elysia, t } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import Mustache from "mustache";
import api from "./routes/api";

const gameTmpl = await Bun.file("assets/game.html.mustache").text();
// another template for index i guess lol

const app = new Elysia()
  .use(api)
  .get(
    "/game",
    async ({ set, query }) => {
      const { id } = query;
      set.headers["content-type"] = "text/html";
      return Mustache.render(gameTmpl, { id });
    },
    { query: t.Object({ id: t.Number() }) }
  )
  .use(staticPlugin({ assets: "public", prefix: "/" }))
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
