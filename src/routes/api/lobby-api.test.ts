import { describe, it, expect, beforeEach, afterEach } from "bun:test";

import { signAccess } from "#/test/util";
import { deleteLobbyById, insertGame, insertLobby } from "#/src/db/queries";
import { db } from "#/src/db";
import { Game, Move } from "#/src/db/schema";
import { eq } from "drizzle-orm";

import lobbyApi from "./lobby-api";
import { LobbyStatus } from "#/src/db/datatypes";
import { gameStates } from "#/src/game/game-state";

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

describe("GET /api/lobby/status", () => {
  it("sends lobby status to any user", async () => {
    const lobbyId = setupLobby("active", DebugUser, EasyComputer);

    const response1 = await lobbyApi.handle(
      new Request(`http://localhost/lobby/status?id=${lobbyId}`, {
        headers: {
          Cookie: `access=${await signAccess({ userId: AnotherDebugUser })}`,
        },
      })
    );

    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("active");

    const response2 = await lobbyApi.handle(
      new Request(`http://localhost/lobby/status?id=${lobbyId}`, {
        headers: {
          Cookie: `access=${await signAccess({ userId: AnotherDebugUser })}`,
          "X-Trigger-Refresh": "true",
        },
      })
    );

    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("active");
    expect(response2.headers.get("HX-Refresh")).toBe("true");

    teardownLobby(lobbyId);
  });
});

describe("GET /api/lobby/is-asleep", () => {
  describe("in an active lobby", () => {
    let lobbyId: number;
    beforeEach(() => {
      lobbyId = setupLobby("active", DebugUser, EasyComputer);
    });

    afterEach(() => {
      teardownLobby(lobbyId);
    });

    it("sends that lobby is asleep", async () => {
      const response = await lobbyApi.handle(
        new Request(`http://localhost/lobby/is-asleep?id=${lobbyId}`, {
          headers: {
            Cookie: `access=${await signAccess({ userId: AnotherDebugUser })}`,
          },
        })
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toBe(true);
    });

    it("sends that lobby is asleep with X-Trigger-Refresh", async () => {
      const response = await lobbyApi.handle(
        new Request(`http://localhost/lobby/is-asleep?id=${lobbyId}`, {
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

      const response = await lobbyApi.handle(
        new Request(`http://localhost/lobby/is-asleep?id=${lobbyId}`, {
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

      const response = await lobbyApi.handle(
        new Request(`http://localhost/lobby/is-asleep?id=${lobbyId}`, {
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

describe("GET /api/lobbies", () => {
  it.todo("sends a list of lobbies to any user", () => {});
});

describe("PATCH /api/lobby/forfeit", () => {
  it.todo("lets a player forfeit the game", () => {});
  it.todo("errors for a non-player", () => {});
  it.todo("errors when the game is waiting", () => {});
  it.todo("errors when the game is finished", () => {});
});

describe("PATCH /api/lobby/join", () => {
  it.todo("lets a user join the game", () => {});
  it.todo("errors when the game is active", () => {});
  it.todo("errors when the game is finished", () => {});
  it.todo("errors when the user is already in the game", () => {});
});

describe("POST /api/lobby", () => {
  it.todo("creates a new waiting lobby if both players are human", () => {});
  it.todo("creates a new active lobby if one player is human", () => {});
  it.todo("creates a new finished lobby if neither player is human", () => {});
  it.todo("throttles when creating too many computer lobbies", () => {});
});

describe("DELETE /api/lobby", () => {
  it.todo("lets the creator delete their own waiting lobby", () => {});
  it.todo("errors when the game is active", () => {});
  it.todo("errors when the game is finished", () => {});
});
