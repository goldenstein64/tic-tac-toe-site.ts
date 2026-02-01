import { Elysia, t } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import html, { Html } from "@elysiajs/html";

import ActiveGameHtml from "./components/game-active";
import WaitingGameHtml from "./components/game-waiting";
import FinishedGameHtml from "./components/game-finished";
import LobbiesHtml from "./components/lobbies";
import LoginHtml from "./components/login";

import jwtAuth, { jwtMustAuth } from "./auth/jwt-auth";
import discordLogin from "./routes/discord-login";

import { selectLobbyById } from "./db/queries";

import api from "./routes/api";
import debug from "./routes/debug";

import { NewLobbyHtml } from "./components/new-lobby";
import { csrf } from "elysia-csrf";
import { gameStates } from "./game/game-state";
import SleepingGameHtml from "./components/game-asleep";

const newLobby = new Elysia({ name: "NewLobby" })
  .use(csrf({ cookie: true }))
  .use(jwtMustAuth())
  .get("/new-lobby", ({ user, csrfToken }) =>
    NewLobbyHtml({ user, csrfToken: csrfToken() }),
  );

export const app = new Elysia({ name: "App" })
  .use(await debug())
  .use(html())
  .use(jwtAuth())
  .use(discordLogin())
  .use(api)
  .onBeforeHandle(({ user, path, redirect }) => {
    if (
      user === null &&
      !path.startsWith("/debug") &&
      !path.startsWith("/public") &&
      path !== "/login"
    )
      return redirect("/login", 302);
  })
  .get("/login", async ({ user, redirect }) =>
    user !== null ? redirect("/", 302) : LoginHtml(),
  )
  .resolve(({ user }) => ({ user: user! }))
  .get("/", ({ user }) => LobbiesHtml({ user }))
  .get(
    "/game",
    ({ query: { id: lobbyId }, user, status }) => {
      const lobby = selectLobbyById.get({ lobbyId });

      switch (lobby?.status) {
        case "active":
          if (gameStates.has(lobbyId)) {
            return <ActiveGameHtml lobby={lobby} user={user} />;
          } else {
            return <SleepingGameHtml lobby={lobby} user={user} />;
          }
        case "waiting":
          return <WaitingGameHtml lobby={lobby} user={user} />;
        case "finished":
          return <FinishedGameHtml lobby={lobby} user={user} />;
        default:
          return status("Not Found");
      }
    },
    { query: t.Object({ id: t.Numeric() }) },
  )
  .use(newLobby)
  .use(staticPlugin());

export type App = typeof app;
