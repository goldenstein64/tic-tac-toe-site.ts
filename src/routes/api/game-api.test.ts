import { describe, it, expect } from "bun:test";
import { once } from "node:events";

import { signAccess, setupActiveLobby } from "#/test/util";

import gameApi from "./game-api";
import { gameStates, GameState } from "#/src/game/game-state";

const EasyComputer = 1;
const DebugUser = 4;
const AnotherDebugUser = 5;

describe("/api/game-move", () => {
  describe("POST", () => {
    it("works", async () => {
      using lobby = setupActiveLobby({
        playerX: DebugUser,
        playerO: EasyComputer,
      });
      const lobbyId = lobby.id;
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
        }),
      );
      expect(response.status).toBe(204);

      expect(moveStreamPromise).resolves.toStrictEqual(["new-move", [0]]);
      expect(newMovePromise).resolves.toStrictEqual([0]);
    });

    it("fails if the lobby doesn't exist", async () => {
      using _lobby = setupActiveLobby({
        playerX: DebugUser,
        playerO: EasyComputer,
      });

      const response = await gameApi.handle(
        new Request("http://localhost/game-move", {
          method: "POST",
          headers: {
            Cookie: `access=${await signAccess({ userId: DebugUser })}`,
          },
          body: new URLSearchParams({ id: String(-1), position: "4" }),
        }),
      );
      expect(response.status).toBe(404);
    });

    it("fails if the lobby doesn't have the user as a player", async () => {
      using lobby = setupActiveLobby({
        playerX: DebugUser,
        playerO: EasyComputer,
      });
      const lobbyId = lobby.id;

      const response = await gameApi.handle(
        new Request("http://localhost/game-move", {
          method: "POST",
          headers: {
            Cookie: `access=${await signAccess({ userId: AnotherDebugUser })}`,
          },
          body: new URLSearchParams({ id: String(lobbyId), position: "6" }),
        }),
      );
      expect(response.status).toBe(401);
    });

    it("fails if the position specifies an occupied slot", async () => {
      using lobby = setupActiveLobby({
        playerX: DebugUser,
        playerO: EasyComputer,
      });
      const lobbyId = lobby.id;

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

describe("GET /api/game/is-asleep", () => {
  describe("in an active lobby", () => {
    it("sends that lobby is asleep", async () => {
      using lobby = setupActiveLobby({
        playerX: DebugUser,
        playerO: EasyComputer,
      });
      const lobbyId = lobby.id;

      const response = await gameApi.handle(
        new Request(`http://localhost/game/is-asleep?id=${lobbyId}`, {
          headers: {
            Cookie: `access=${await signAccess({ userId: AnotherDebugUser })}`,
          },
        }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toBe(true);
    });

    it("sends that lobby is asleep with X-Trigger-Refresh", async () => {
      using lobby = setupActiveLobby({
        playerX: DebugUser,
        playerO: EasyComputer,
      });
      const lobbyId = lobby.id;

      const response = await gameApi.handle(
        new Request(`http://localhost/game/is-asleep?id=${lobbyId}`, {
          headers: {
            Cookie: `access=${await signAccess({ userId: AnotherDebugUser })}`,
            "X-Trigger-Refresh": "true",
          },
        }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toBe(true);
      expect(response.headers.has("HX-Refresh")).toBeFalse();
    });

    it("sends that lobby is not asleep", async () => {
      using lobby = setupActiveLobby({
        playerX: DebugUser,
        playerO: EasyComputer,
      });
      const lobbyId = lobby.id;
      using _state = gameStates.getOrCreate(lobbyId);

      const response = await gameApi.handle(
        new Request(`http://localhost/game/is-asleep?id=${lobbyId}`, {
          headers: {
            Cookie: `access=${await signAccess({ userId: AnotherDebugUser })}`,
          },
        }),
      );

      gameStates.delete(lobbyId);

      expect(response.status).toBe(200);
      expect(await response.json()).toBe(false);
    });

    it("sends HX-Refresh header when X-Trigger-Refresh is supplied", async () => {
      using lobby = setupActiveLobby({
        playerX: DebugUser,
        playerO: EasyComputer,
      });
      const lobbyId = lobby.id;
      using _state = gameStates.getOrCreate(lobbyId);

      const response = await gameApi.handle(
        new Request(`http://localhost/game/is-asleep?id=${lobbyId}`, {
          headers: {
            Cookie: `access=${await signAccess({ userId: AnotherDebugUser })}`,
            "X-Trigger-Refresh": "true",
          },
        }),
      );

      gameStates.delete(lobbyId);

      expect(response.status).toBe(200);
      expect(await response.json()).toBe(false);
      expect(response.headers.get("HX-Refresh")).toBe("true");
    });
  });
});
