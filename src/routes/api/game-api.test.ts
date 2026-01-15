import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "bun:test";
import { once } from "node:events";
import { eq } from "drizzle-orm";

import { signAccess } from "#/test/util";

import { deleteLobbyById, insertGame, insertLobby } from "#/src/db/queries";
import { Game, Move } from "#/src/db/schema";
import { LobbyStatus } from "#/src/db/datatypes";
import { db } from "#/src/db";

import gameApi from "./game-api";
import { gameStates, GameState } from "#/src/game/game-state";

const EasyComputer = 1;
const DebugUser = 4;
const AnotherDebugUser = 5;

function setupLobby(status: LobbyStatus, playerX: number, playerO?: number) {
  const lobby = insertLobby.get({ userId: playerX, status })!;
  const lobbyId = lobby.id;
  if (playerO !== undefined) {
    insertGame.run({
      lobbyId,
      playerX,
      playerO,
    });
  }
  return lobbyId;
}

function teardownLobby(lobbyId: number) {
  db.delete(Move).where(eq(Move.lobbyId, lobbyId)).run();
  db.delete(Game).where(eq(Game.lobbyId, lobbyId)).run();
  deleteLobbyById.run({ id: lobbyId });
}

describe("/api/game-move", () => {
  describe("POST", () => {
    let lobbyId: number;
    beforeAll(() => {
      lobbyId = setupLobby("active", DebugUser, EasyComputer);
    });

    afterAll(() => {
      teardownLobby(lobbyId);
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

describe("GET /api/game/is-asleep", () => {
  describe("in an active lobby", () => {
    let lobbyId: number;
    beforeEach(() => {
      lobbyId = setupLobby("active", DebugUser, EasyComputer);
    });

    afterEach(() => {
      teardownLobby(lobbyId);
    });

    it("sends that lobby is asleep", async () => {
      const response = await gameApi.handle(
        new Request(`http://localhost/game/is-asleep?id=${lobbyId}`, {
          headers: {
            Cookie: `access=${await signAccess({ userId: AnotherDebugUser })}`,
          },
        })
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toBe(true);
    });

    it("sends that lobby is asleep with X-Trigger-Refresh", async () => {
      const response = await gameApi.handle(
        new Request(`http://localhost/game/is-asleep?id=${lobbyId}`, {
          headers: {
            Cookie: `access=${await signAccess({ userId: AnotherDebugUser })}`,
            "X-Trigger-Refresh": "true",
          },
        })
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toBe(true);
      expect(response.headers.has("HX-Refresh")).toBeFalse();
    });

    it("sends that lobby is not asleep", async () => {
      using _state = gameStates.getOrCreate(lobbyId);

      const response = await gameApi.handle(
        new Request(`http://localhost/game/is-asleep?id=${lobbyId}`, {
          headers: {
            Cookie: `access=${await signAccess({ userId: AnotherDebugUser })}`,
          },
        })
      );

      gameStates.delete(lobbyId);

      expect(response.status).toBe(200);
      expect(await response.json()).toBe(false);
    });

    it("sends HX-Refresh header when X-Trigger-Refresh is supplied", async () => {
      using _state = gameStates.getOrCreate(lobbyId);

      const response = await gameApi.handle(
        new Request(`http://localhost/game/is-asleep?id=${lobbyId}`, {
          headers: {
            Cookie: `access=${await signAccess({ userId: AnotherDebugUser })}`,
            "X-Trigger-Refresh": "true",
          },
        })
      );

      gameStates.delete(lobbyId);

      expect(response.status).toBe(200);
      expect(await response.json()).toBe(false);
      expect(response.headers.get("HX-Refresh")).toBe("true");
    });
  });
});
