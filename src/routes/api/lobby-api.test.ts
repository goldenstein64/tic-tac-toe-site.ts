import { describe, it, expect } from "bun:test";

import { createTestClient } from "#/test/clients";
import { getHTML, setupDocument } from "#/test/documents";
import {
  setupWaitingLobby,
  setupActiveLobby,
  setupFinishedLobby,
  DisposableLobby,
} from "#/test/lobbies";

import lobbyApi from "./lobby-api";
import { app } from "../../app";
import {
  selectFinishedLobbyById,
  selectGameById,
  selectLobbyById,
} from "#/src/db/queries";

const EasyComputer = 1;
const DebugUser = 4;
const AnotherDebugUser = 5;

const inHandler = (api: { handle(request: Request): Promise<Response> }) => ({
  as: createTestClient(api),
});
async function getCsrf() {
  const newLobbyResponse = await inHandler(app).as(DebugUser).get("/new-lobby");
  const cookie = newLobbyResponse.headers.get("set-cookie");
  if (cookie === null) {
    throw new Error("_csrf cookie not found!");
  }
  const html = await newLobbyResponse.text();
  const document = await setupDocument(html);
  const csrfField = document.querySelector(
    "input[name='_csrf']",
  ) as HTMLInputElement | null;
  if (csrfField === null) {
    throw new Error("_csrf input not found!");
  }
  return [cookie, csrfField.value] as const;
}

const as = createTestClient(lobbyApi);

describe("GET /api/lobby/status", () => {
  it("sends lobby status", async () => {
    using lobby = setupActiveLobby({
      playerX: DebugUser,
      playerO: EasyComputer,
    });
    const lobbyId = lobby.id;

    const response = await as(AnotherDebugUser)
      .withParams({ id: lobbyId })
      .get("/lobby/status");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("active");
  });

  it("sends lobby status with X-Trigger-Refresh", async () => {
    using lobby = setupActiveLobby({
      playerX: DebugUser,
      playerO: EasyComputer,
    });
    const lobbyId = lobby.id;

    const response = await as(AnotherDebugUser, {
      "X-Trigger-Refresh": "true",
    })
      .withParams({ id: lobbyId })
      .get("/lobby/status");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("active");
    expect(response.headers.get("HX-Refresh")).toBe("true");
  });

  const NONEXISTENT_LOBBY_ID = -1;

  it("errors if lobby does not exist", async () => {
    const lobbyId = NONEXISTENT_LOBBY_ID;

    const response = await as(AnotherDebugUser)
      .withParams({ id: lobbyId })
      .get("/lobby/status");

    expect(response.status).toBe(404);
  });
});

describe("GET /api/lobby/list", () => {
  it("sends a list of available lobbies", async () => {
    using stack = new DisposableStack();
    for (let i = 0; i < 3; i++) {
      stack.use(setupWaitingLobby(AnotherDebugUser));
    }

    const response = await as(DebugUser)
      .withParams({ type: "available", page: 1 })
      .get("/lobby/list");

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
      .get("/lobby/list");

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
      .get("/lobby/list");

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
      .get("/lobby/list");

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
    const finishedLobby = selectFinishedLobbyById.get({ lobbyId: lobby.id });
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

    expect(response.status).toBe(409);
    const newLobby = selectLobbyById.get({ lobbyId: lobby.id });
    const finishedLobby = selectFinishedLobbyById.get({ lobbyId: lobby.id });
    expect(newLobby?.status).toBe("active");
    expect(finishedLobby).toBeUndefined();
  });

  it("errors when the game is waiting", async () => {
    using lobby: DisposableLobby = setupWaitingLobby(DebugUser);
    const response = await as(DebugUser).patch(
      "/lobby/forfeit",
      new URLSearchParams({ id: String(lobby.id) }),
    );

    expect(response.status).toBe(409);
    const newLobby = selectLobbyById.get({ lobbyId: lobby.id });
    const finishedLobby = selectFinishedLobbyById.get({ lobbyId: lobby.id });
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

    expect(response.status).toBe(409);
    const newLobby = selectLobbyById.get({ lobbyId: lobby.id });
    const finishedLobby = selectFinishedLobbyById.get({ lobbyId: lobby.id });
    expect(newLobby?.status).toBe("finished");
    expect(finishedLobby?.winner).toBe(DebugUser);
  });
});

describe("PATCH /api/lobby/join", () => {
  it("lets a user join the game", async () => {
    using lobby: DisposableLobby = setupWaitingLobby(DebugUser);

    const response = await as(AnotherDebugUser).patch(
      "/lobby/join",
      new URLSearchParams({ id: String(lobby.id) }),
    );

    expect(response.status).toBe(204);
    const newLobby = selectLobbyById.get({ lobbyId: lobby.id });
    if (newLobby === undefined) expect.unreachable();
    expect(newLobby.status).toBe("active");
    const game = selectGameById.get({ lobbyId: lobby.id });
    if (game === undefined) expect.unreachable();
    expect(new Set([game.playerX, game.playerO])).toStrictEqual(
      new Set([DebugUser, AnotherDebugUser]),
    );
  });

  it("errors when the game is active", async () => {
    using lobby: DisposableLobby = setupActiveLobby({
      playerX: DebugUser,
      playerO: EasyComputer,
    });
    const lobbyId = lobby.id;

    const response = await as(AnotherDebugUser).patch(
      "/lobby/join",
      new URLSearchParams({ id: String(lobbyId) }),
    );

    expect(response.status, await response.text()).toBe(422);
    const game = selectGameById.get({ lobbyId });
    if (game === undefined) expect.unreachable();
    expect(game).toMatchObject({
      lobbyId,
      playerX: DebugUser,
      playerO: EasyComputer,
    });
  });

  it("errors when the game is finished", async () => {
    using lobby: DisposableLobby = setupFinishedLobby({
      playerX: DebugUser,
      playerO: EasyComputer,
      winner: undefined,
    });
    const lobbyId = lobby.id;

    const response = await as(AnotherDebugUser).patch(
      "/lobby/join",
      new URLSearchParams({ id: String(lobbyId) }),
    );

    expect(response.status, await response.text()).toBe(422);
    const game = selectGameById.get({ lobbyId });
    if (game === undefined) expect.unreachable();
    expect(game).toMatchObject({
      lobbyId,
      playerX: DebugUser,
      playerO: EasyComputer,
    });
  });

  it("errors when the user is already in the game", async () => {
    using lobby: DisposableLobby = setupWaitingLobby(DebugUser);

    const response = await as(DebugUser).patch(
      "/lobby/join",
      new URLSearchParams({ id: String(lobby.id) }),
    );

    expect(response.status, await response.text()).toBe(422);
    const newLobby = selectLobbyById.get({ lobbyId: lobby.id });
    expect(newLobby?.status).toBe("waiting");
  });
});

describe("POST /api/lobby", () => {
  const Human = -1;

  it("creates a new waiting lobby if both players are human", async () => {
    const [cookie, csrfToken] = await getCsrf();
    const response = await as(DebugUser, { Cookie: cookie }).post(
      "/lobby",
      new URLSearchParams({
        _csrf: csrfToken,
        typeX: String(Human),
        typeO: String(Human),
      }),
    );

    expect(response.status, await response.text()).toBe(201);
    const redirect = response.headers.get("HX-Redirect");
    if (redirect === null) expect.unreachable();

    const redirectUrl = new URL(redirect, "http://localhost");
    const lobbyIdStr = redirectUrl.searchParams.get("id");
    if (lobbyIdStr === null) expect.unreachable();
    const lobbyId = parseInt(lobbyIdStr);

    expect(selectLobbyById.get({ lobbyId })).toMatchObject({
      id: lobbyId,
      createdBy: DebugUser,
      status: "waiting",
    });
    expect(selectGameById.get({ lobbyId })).toBeUndefined();
    expect(selectFinishedLobbyById.get({ lobbyId })).toBeUndefined();
  });

  it("creates a new active lobby if one player is human", async () => {
    const [cookie, csrfToken] = await getCsrf();

    const response = await as(DebugUser, { Cookie: cookie }).post(
      "/lobby",
      new URLSearchParams({
        _csrf: csrfToken,
        typeX: String(Human),
        typeO: String(EasyComputer),
      }),
    );

    expect(response.status).toBe(201);
    const redirect = response.headers.get("HX-Redirect");
    if (redirect === null) expect.unreachable();

    const redirectUrl = new URL(redirect, "http://localhost");
    const lobbyIdStr = redirectUrl.searchParams.get("id");
    if (lobbyIdStr === null) expect.unreachable();
    const lobbyId = parseInt(lobbyIdStr);

    expect(selectLobbyById.get({ lobbyId })).toMatchObject({
      id: lobbyId,
      createdBy: DebugUser,
      status: "active",
    });
    expect(selectGameById.get({ lobbyId })).toMatchObject({
      lobbyId,
      playerX: DebugUser,
      playerO: EasyComputer,
    });
    expect(selectFinishedLobbyById.get({ lobbyId })).toBeUndefined();
  });

  it("creates a new finished lobby if neither player is human", async () => {
    const [cookie, csrfToken] = await getCsrf();

    const response = await as(DebugUser, { Cookie: cookie }).post(
      "/lobby",
      new URLSearchParams({
        _csrf: csrfToken,
        typeX: String(EasyComputer),
        typeO: String(EasyComputer),
      }),
    );

    expect(response.status, await response.text()).toBe(201);
    const redirect = response.headers.get("HX-Redirect");
    if (redirect === null) expect.unreachable();

    const redirectUrl = new URL(redirect, "http://localhost");
    const lobbyIdStr = redirectUrl.searchParams.get("id");
    if (lobbyIdStr === null) expect.unreachable();
    const lobbyId = parseInt(lobbyIdStr);

    expect(selectLobbyById.get({ lobbyId })).toMatchObject({
      id: lobbyId,
      createdBy: DebugUser,
      status: "finished",
    });
    expect(selectGameById.get({ lobbyId })).toMatchObject({
      lobbyId,
      playerX: EasyComputer,
      playerO: EasyComputer,
    });
    expect(selectFinishedLobbyById.get({ lobbyId })).toMatchObject({
      id: lobbyId,
    });
  });

  // not sure how I would go about testing this. It would definitely be
  // expensive to run though! Maybe it should go in its own file.
  it.todo("throttles when creating too many computer lobbies", () => {});
});

describe("DELETE /api/lobby", () => {
  it("lets the creator delete their own waiting lobby", async () => {
    using lobby = setupWaitingLobby(DebugUser);

    const response = await as(DebugUser)
      .withParams({ id: lobby.id })
      .delete("/lobby");

    expect(response.status, await response.text()).toBe(200);
    expect(selectLobbyById.get({ lobbyId: lobby.id })).toBeUndefined();
  });
  it.todo("errors when the game is active", () => {});
  it.todo("errors when the game is finished", () => {});
});
