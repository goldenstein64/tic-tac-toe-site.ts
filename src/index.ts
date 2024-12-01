import { Elysia, error, redirect, t } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import html from "@elysiajs/html";

import ActiveGameHtml from "./components/game-active";
import DormantGameHtml from "./components/game-dormant";
import LobbiesHtml from "./components/lobbies";
import LoginHtml from "./components/login";

import jwtAuth from "./libs/jwt-auth";

import gameApi from "./routes/game-api";
import lobbyApi from "./routes/lobby-api";
import discordOAuth from "./libs/discord-oauth";
import sessionApi from "./routes/session-api";
import debug from "./routes/debug";
import { intString } from "./types";
import { db, typePrepared } from "./db";
import { Lobby } from "./db/schema";
import { eq, sql } from "drizzle-orm";

const _placeholders: any = undefined;

const selectLobbyById = typePrepared(
  db
    .select()
    .from(Lobby)
    .where(eq(Lobby.id, sql.placeholder("lobbyId"))),
  _placeholders as { lobbyId: number }
);

const app = new Elysia({ name: "App" })
  .use(debug())
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
        : DormantGameHtml({ lobby, user })
      );
    },
    { query: t.Object({ id: intString }) }
  )
  .get("/new-lobby", () => Bun.file("./private/new-lobby.html"))
  .use(staticPlugin())
  .listen({ port: 3000 });

export type App = typeof app;

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port} in ${Bun.env.NODE_ENV}`
);
