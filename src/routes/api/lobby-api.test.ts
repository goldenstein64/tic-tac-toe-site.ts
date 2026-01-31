import { describe, it, expect } from "bun:test";

import {
  signAccess,
  setupDocument,
  setupWaitingLobby,
  setupActiveLobby,
  setupFinishedLobby,
  DisposableLobby,
} from "#/test/util";

import lobbyApi from "./lobby-api";
import { selectFinishedLobby, selectLobbyById } from "#/src/db/queries";

const EasyComputer = 1;
const DebugUser = 4;
const AnotherDebugUser = 5;

class TestClient {
  private params: URLSearchParams;

  constructor(private headers: Promise<Headers>) {
    this.params = new URLSearchParams();
  }

  withParams(params: Record<string, unknown>): this {
    this.params = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    );
    return this;
  }

  async get(url: string): Promise<Response> {
    const reqUrl = new URL(url, "http://localhost");
    reqUrl.search = this.params.toString();
    const headers = await this.headers;
    const request = new Request(reqUrl, { headers });
    return lobbyApi.handle(request);
  }

  async patch(url: string, body?: BodyInit): Promise<Response> {
    const reqUrl = new URL(url, "http://localhost");
    reqUrl.search = this.params.toString();
    const headers = await this.headers;
    const request = new Request(reqUrl, { method: "PATCH", body, headers });
    return lobbyApi.handle(request);
  }
}

function as(userId: number, headers?: HeadersInit) {
  const reqHeaders = new Headers(headers);
  const headersPromise = signAccess({ userId }).then((access) => {
    const accessCookie = new Bun.Cookie("access", access);
    reqHeaders.append("Cookie", accessCookie.toString());
    return reqHeaders;
  });
  return new TestClient(headersPromise);
}

describe("GET /api/lobby/status", () => {
  it("sends lobby status to any user", async () => {
    using lobby = setupActiveLobby({
      playerX: DebugUser,
      playerO: EasyComputer,
    });
    const lobbyId = lobby.id;

    const response1 = await as(AnotherDebugUser)
      .withParams({ id: lobbyId })
      .get("/lobby/status");

    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("active");

    const response2 = await as(AnotherDebugUser, {
      "X-Trigger-Refresh": "true",
    })
      .withParams({ id: lobbyId })
      .get("/lobby/status");

    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("active");
    expect(response2.headers.get("HX-Refresh")).toBe("true");
  });
});

describe("GET /api/lobbies", () => {
  it("sends a list of available lobbies", async () => {
    using stack = new DisposableStack();
    for (let i = 0; i < 3; i++) {
      stack.use(setupWaitingLobby(AnotherDebugUser));
    }

    const response = await as(DebugUser)
      .withParams({ type: "available", page: 1 })
      .get("/lobbies");

    const document = await setupDocument();
    document.body.innerHTML = await response.text();
    const rows = document.querySelectorAll("table > tbody > tr");
    expect(rows.length).toBe(4);
  });

  it("sends a list of waiting lobbies", async () => {
    using stack = new DisposableStack();
    for (let i = 0; i < 3; i++) {
      stack.use(setupWaitingLobby(DebugUser));
    }

    const response = await as(DebugUser)
      .withParams({ type: "waiting", page: 1 })
      .get("/lobbies");

    const document = await setupDocument();
    document.body.innerHTML = await response.text();
    const rows = document.querySelectorAll("table > tbody > tr");
    expect(rows.length).toBe(4);
  });

  it("sends a list of active lobbies", async () => {
    using stack = new DisposableStack();
    for (let i = 0; i < 3; i++) {
      stack.use(
        setupActiveLobby({ playerX: DebugUser, playerO: EasyComputer }),
      );
    }

    const response = await as(DebugUser)
      .withParams({ type: "active", page: 1 })
      .get("/lobbies");

    const document = await setupDocument();
    document.body.innerHTML = await response.text();
    const rows = document.querySelectorAll("table > tbody > tr");
    expect(rows.length).toBe(4);
  });

  it("sends a list of finished lobbies", async () => {
    using stack = new DisposableStack();
    for (let i = 0; i < 3; i++) {
      stack.use(
        setupFinishedLobby({
          playerX: DebugUser,
          playerO: EasyComputer,
          winner: DebugUser,
        }),
      );
    }

    const response = await as(DebugUser)
      .withParams({ type: "finished", page: 1 })
      .get("/lobbies");

    const document = await setupDocument();
    document.body.innerHTML = await response.text();
    const rows = document.querySelectorAll("table > tbody > tr");
    expect(rows.length).toBe(5);
  });
});

describe("PATCH /api/lobby/forfeit", () => {
  it("lets a player forfeit the game", async () => {
    using lobby = setupActiveLobby({
      playerX: DebugUser,
      playerO: EasyComputer,
    });
    const response = await as(DebugUser).patch(
      "/lobby/forfeit",
      new URLSearchParams({ id: String(lobby.id) }),
    );

    expect(response.status).toBe(204);
    const newLobby = selectLobbyById.get({ lobbyId: lobby.id });
    const finishedLobby = selectFinishedLobby.get({ lobbyId: lobby.id });
    expect(newLobby?.status).toBe("finished");
    expect(finishedLobby?.winner).toBe(EasyComputer);
  });

  it("errors for a non-player", async () => {
    using lobby = setupActiveLobby({
      playerX: DebugUser,
      playerO: EasyComputer,
    });
    const response = await as(AnotherDebugUser).patch(
      "/lobby/forfeit",
      new URLSearchParams({ id: String(lobby.id) }),
    );

    expect(response.status).toBe(403);
    const newLobby = selectLobbyById.get({ lobbyId: lobby.id });
    const finishedLobby = selectFinishedLobby.get({ lobbyId: lobby.id });
    expect(newLobby?.status).toBe("active");
    expect(finishedLobby).toBeUndefined();
  });

  it("errors when the game is waiting", async () => {
    using lobby: DisposableLobby = setupWaitingLobby(DebugUser);
    const response = await as(DebugUser).patch(
      "/lobby/forfeit",
      new URLSearchParams({ id: String(lobby.id) }),
    );

    expect(response.status).toBe(403);
    const newLobby = selectLobbyById.get({ lobbyId: lobby.id });
    const finishedLobby = selectFinishedLobby.get({ lobbyId: lobby.id });
    expect(newLobby?.status).toBe("waiting");
    expect(finishedLobby).toBeUndefined();
  });
  it("errors when the game is finished", async () => {
    using lobby: DisposableLobby = setupFinishedLobby({
      playerX: DebugUser,
      playerO: EasyComputer,
      winner: DebugUser,
    });

    const response = await as(DebugUser).patch(
      "/lobby/forfeit",
      new URLSearchParams({ id: String(lobby.id) }),
    );

    expect(response.status).toBe(403);
    const newLobby = selectLobbyById.get({ lobbyId: lobby.id });
    const finishedLobby = selectFinishedLobby.get({ lobbyId: lobby.id });
    expect(newLobby?.status).toBe("finished");
    expect(finishedLobby?.winner).toBe(DebugUser);
  });
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
