import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { once } from "node:events";
import { eq } from "drizzle-orm";

import { signAccess } from "#/test/util";

import { gameStates, GameState } from "#/src/game/game-state";
import { deleteLobbyById, insertGame, insertLobby } from "#/src/db/queries";
import { Game, Move } from "#/src/db/schema";
import { db } from "#/src/db";

import gameApi from "./game-api";

const EasyComputer = 1;
const DebugUser = 4;
const AnotherDebugUser = 5;

describe("/api/game-move", () => {
  describe("POST", () => {
    let lobbyId: number;
    beforeAll(() => {
      const lobby = insertLobby.get({ userId: DebugUser, status: "active" })!;
      expect(lobby).toBeObject();
      lobbyId = lobby.id;
      insertGame.run({
        lobbyId: lobbyId,
        playerX: DebugUser,
        playerO: EasyComputer,
      });
    });

    afterAll(() => {
      db.delete(Move).where(eq(Move.lobbyId, lobbyId)).run();
      db.delete(Game).where(eq(Game.lobbyId, lobbyId)).run();
      deleteLobbyById.run({ id: lobbyId });
    });

    it("works", async () => {
      const state = new GameState(lobbyId);
      gameStates.set(lobbyId, state);

      const moveStreamPromise = once(state, "move-stream");
      const newMovePromise = once(state, "new-move");

      const response = await gameApi.handle(
        new Request("http://localhost/game-move", {
          method: "POST",
          headers: {
            Cookie: `access=${await signAccess({ userId: DebugUser })}`,
          },
          body: new URLSearchParams({ id: String(lobbyId), position: "4" }),
        })
      );
      expect(response.status).toBe(204);

      expect(moveStreamPromise).resolves.toStrictEqual(["new-move", [0]]);
      expect(newMovePromise).resolves.toStrictEqual([0]);
    });

    it("fails if the lobby doesn't exist", async () => {
      const response = await gameApi.handle(
        new Request("http://localhost/game-move", {
          method: "POST",
          headers: {
            Cookie: `access=${await signAccess({ userId: DebugUser })}`,
          },
          body: new URLSearchParams({ id: String(-1), position: "4" }),
        })
      );
      expect(response.status).toBe(404);
    });

    it("fails if the lobby doesn't have the user as a player", async () => {
      const response = await gameApi.handle(
        new Request("http://localhost/game-move", {
          method: "POST",
          headers: {
            Cookie: `access=${await signAccess({ userId: AnotherDebugUser })}`,
          },
          body: new URLSearchParams({ id: String(lobbyId), position: "6" }),
        })
      );
      expect(response.status).toBe(401);
    });

    it("fails if the position specifies an occupied slot", async () => {
      async function makeRequest() {
        return new Request("http://localhost/game-move", {
          method: "POST",
          headers: {
            Cookie: `access=${await signAccess({ userId: DebugUser })}`,
          },
          body: new URLSearchParams({ id: String(lobbyId), position: "7" }),
        });
      }

      const response1: Response = await gameApi.handle(await makeRequest());
      expect(response1.status).toBe(204);

      const response2: Response = await gameApi.handle(await makeRequest());
      expect(response2.status).toBe(401);
    });
  });

  describe.todo("GET", () => {});
});
