import { describe, it, expect } from "bun:test";
import { once } from "node:events";

import { setupActiveLobby } from "#/test/lobbies";

import gameApi from "./game-api";
import { gameStates, GameState } from "#/src/game/game-state";
import { createTestClient } from "#/test/clients";

const EasyComputer = 1;
const DebugUser = 4;
const AnotherDebugUser = 5;

const as = createTestClient(gameApi);

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

      const response = await as(DebugUser).post(
        "/game-move",
        new URLSearchParams({ id: String(lobbyId), position: String(4) }),
      );

      expect(response.status).toBe(204);

      expect(await moveStreamPromise).toStrictEqual(["new-move", [0]]);
      expect(await newMovePromise).toStrictEqual([0]);
    });

    it("fails if the lobby doesn't exist", async () => {
      using _lobby = setupActiveLobby({
        playerX: DebugUser,
        playerO: EasyComputer,
      });

      const response = await as(DebugUser).post(
        "/game-move",
        new URLSearchParams({ id: String(-1), position: String(4) }),
      );

      expect(response.status).toBe(404);
    });

    it("fails if the lobby doesn't have the user as a player", async () => {
      using lobby = setupActiveLobby({
        playerX: DebugUser,
        playerO: EasyComputer,
      });
      const lobbyId = lobby.id;

      const response = await as(AnotherDebugUser).post(
        "/game-move",
        new URLSearchParams({ id: String(lobbyId), position: String(6) }),
      );

      expect(response.status).toBe(401);
    });

    it("fails if the position specifies an occupied slot", async () => {
      using lobby = setupActiveLobby({
        playerX: DebugUser,
        playerO: EasyComputer,
      });
      const lobbyId = lobby.id;

      async function sendRequest() {
        return await as(DebugUser).post(
          "/game-move",
          new URLSearchParams({ id: String(lobbyId), position: String(7) }),
        );
      }

      const response1: Response = await sendRequest();
      expect(response1.status).toBe(204);

      const response2: Response = await sendRequest();
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

      const response = await as(AnotherDebugUser)
        .withParams({ id: lobbyId })
        .get("/game/is-asleep");

      expect(response.status).toBe(200);
      expect(await response.json()).toBe(true);
    });

    it("sends that lobby is asleep with X-Trigger-Refresh", async () => {
      using lobby = setupActiveLobby({
        playerX: DebugUser,
        playerO: EasyComputer,
      });
      const lobbyId = lobby.id;

      const response = await as(AnotherDebugUser, {
        "X-Trigger-Refresh": "true",
      })
        .withParams({ id: lobbyId })
        .get("/game/is-asleep");

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

      const response = await as(AnotherDebugUser)
        .withParams({ id: lobbyId })
        .get("/game/is-asleep");

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

      const response = await as(AnotherDebugUser, {
        "X-Trigger-Refresh": "true",
      })
        .withParams({ id: lobbyId })
        .get("/game/is-asleep");

      gameStates.delete(lobbyId);

      expect(response.status).toBe(200);
      expect(await response.json()).toBe(false);
      expect(response.headers.get("HX-Refresh")).toBe("true");
    });
  });
});
