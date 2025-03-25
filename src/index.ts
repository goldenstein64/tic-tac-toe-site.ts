import { Elysia, error, redirect, t } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import html from "@elysiajs/html";

import ActiveGameHtml from "./components/game-active";
import WaitingGameHtml from "./components/game-waiting";
import FinishedGameHtml from "./components/game-finished";
import LobbiesHtml from "./components/lobbies";
import LoginHtml from "./components/login";

import jwtAuth from "./libs/jwt-auth";
import discordOAuth from "./libs/discord-oauth";

import { intString } from "./types";

import { selectLobbyById } from "./db/queries";

import gameApi from "./routes/game-api";
import lobbyApi from "./routes/lobby-api";
import sessionApi from "./routes/session-api";
import debug from "./routes/debug";

const app = new Elysia({ name: "App" })
  .use(await debug())
  .use(html())
  .use(jwtAuth())
  .use(discordOAuth())
  .get("/login", async ({ user }) => (user ? redirect("/", 302) : LoginHtml()))
  .guard({
    async beforeHandle({ user, path }) {
      if (!user && !path.startsWith("/debug") && !path.startsWith("/public"))
        return redirect("/login", 302);
    },
  })
  .resolve(({ user }) => ({ user: user! }))
  .use(gameApi)
  .use(lobbyApi)
  .use(sessionApi)
  .get("/", ({ user }) => LobbiesHtml({ user }))
  .get(
    "/game",
    ({ query: { id: lobbyId }, user }) => {
      const lobby = selectLobbyById.get({ lobbyId });
      return (
        !lobby ? error("Not Found")
        : lobby.status === "active" ? ActiveGameHtml({ lobby, user })
        : lobby.status === "waiting" ? WaitingGameHtml({ lobby })
        : lobby.status === "finished" ? FinishedGameHtml({ lobby })
        : error("Not Found")
      );
    },
    { query: t.Object({ id: intString }) }
  )
  .get("/new-lobby", () => Bun.file("./private/new-lobby.html"))
  .use(staticPlugin())
  .listen({ port: 3000, idleTimeout: -1 });

export type App = typeof app;

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port} in ${Bun.env.NODE_ENV}`
);
