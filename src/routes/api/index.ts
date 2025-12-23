import Elysia from "elysia";
import gameApi from "./game-api";
import lobbyApi from "./lobby-api";
import sessionApi from "./session-api";

export default new Elysia({ prefix: "/api" })
  .use(gameApi)
  .use(lobbyApi)
  .use(sessionApi);
