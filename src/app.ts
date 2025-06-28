import { Elysia, t } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import html from "@elysiajs/html";

import ActiveGameHtml from "./components/game-active";
import WaitingGameHtml from "./components/game-waiting";
import FinishedGameHtml from "./components/game-finished";
import LobbiesHtml from "./components/lobbies";
import LoginHtml from "./components/login";

import jwtAuth from "./libs/jwt-auth";
import discordLogin from "./libs/discord-login";

import { intString } from "./types";

import { selectLobbyById } from "./db/queries";

import gameApi from "./routes/game-api";
import lobbyApi from "./routes/lobby-api";
import sessionApi from "./routes/session-api";
import debug from "./routes/debug";

export const app = new Elysia({ name: "App" })
  .use(await debug())
  .use(html())
  .use(jwtAuth())
  .use(discordLogin())
  .get("/login", async ({ user, redirect }) => {
    return user ? redirect("/", 302) : LoginHtml();
  })
  .guard({
    async beforeHandle({ user, path, redirect }) {
      if (
        !user &&
        !path.startsWith("/debug") &&
        !path.startsWith("/public") &&
        path !== "/login"
      ) {
        return redirect("/login", 302);
      }
    },
  })
  .resolve(({ user }) => ({ user: user! }))
  .use(gameApi)
  .use(lobbyApi)
  .use(sessionApi)
  .get("/", ({ user }) => LobbiesHtml({ user }))
  .get(
    "/game",
    ({ query: { id: lobbyId }, user, status }) => {
      const lobby = selectLobbyById.get({ lobbyId });
      return (
        !lobby ? status(404)
        : lobby.status === "active" ? ActiveGameHtml({ lobby, user })
        : lobby.status === "waiting" ? WaitingGameHtml({ lobby })
        : lobby.status === "finished" ? FinishedGameHtml({ lobby })
        : status(404)
      );
    },
    { query: t.Object({ id: intString }) }
  )
  .get("/new-lobby", () => Bun.file("./private/new-lobby.html"))
  .use(staticPlugin());

export type App = typeof app;
