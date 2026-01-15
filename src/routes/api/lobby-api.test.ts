import { describe, it, expect } from "bun:test";

import { signAccess } from "#/test/util";
import { deleteLobbyById, insertGame, insertLobby } from "#/src/db/queries";
import { db } from "#/src/db";
import { Game, Move } from "#/src/db/schema";
import { eq } from "drizzle-orm";

import lobbyApi from "./lobby-api";
import { LobbyStatus } from "#/src/db/datatypes";

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
