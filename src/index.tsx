import { Elysia, redirect, t } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import html from "@elysiajs/html";

import GameHtml from "./components/game";
import LobbiesHtml from "./components/lobbies";
import LoginHtml from "./components/login";

import JWTAuth from "./libs/jwt-auth";

import gameApi from "./routes/game-api";
import lobbyApi from "./routes/lobby-api";
import userApi from "./routes/user-api";
import { intString } from "./types";
import swagger from "@elysiajs/swagger";

const app = new Elysia({ name: "app" })
  .use(swagger())
  .use(html())
  .use(JWTAuth)
  .get("/login", async ({ user }) => (user ? redirect("/", 302) : LoginHtml()))
  .guard({
    cookie: t.Object({
      access: t.String(),
      refresh: t.String(),
    }),
    async beforeHandle({ user }) {
      if (!user) return redirect("/login", 302);
    },
  })
  .resolve(({ user }) => ({ user: user! }))
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
  .listen({ port: 3000 });

export type App = typeof app;

console.log(`NODE_ENV='${Bun.env.NODE_ENV}'`);
console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
