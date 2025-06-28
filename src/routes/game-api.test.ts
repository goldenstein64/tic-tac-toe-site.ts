import { describe, it, expect } from "bun:test";
import { once } from "node:events";

import gameApi from "./game-api";
import { signAccess } from "#/test/util";
import { gameStates, GameState } from "../libs/game-state";
import { insertGame, insertLobby } from "../db/queries";

const EasyComputer = 1;
const DebugUser = 4;

describe("/api/game-move", () => {
  describe("POST", () => {
    it("works", async () => {
      const lobby = insertLobby.get({ userId: DebugUser, status: "active" })!;
      expect(lobby).toBeTruthy();
      insertGame.run({
        lobbyId: lobby.id,
        playerX: DebugUser,
        playerO: EasyComputer,
      });

      const state = new GameState(lobby.id, DebugUser, EasyComputer);
      gameStates.set(lobby.id, state);
      const body = new URLSearchParams({
        id: lobby.id.toString(),
        position: "4",
      });
      const request = new Request("http://localhost/api/game-move", {
        method: "POST",
        headers: {
          Cookie: `access=${await signAccess({ userId: DebugUser })}`,
        },
        body,
      });

      const moveStreamPromise = once(state, "move-stream");
      const newMovePromise = once(state, "new-move");

      const response = await gameApi.handle(request);
      expect(response.status).toBe(204);

      expect(moveStreamPromise).resolves.toStrictEqual(["new-move", [0]]);
      expect(newMovePromise).resolves.toStrictEqual([0]);
    });
  });
});
