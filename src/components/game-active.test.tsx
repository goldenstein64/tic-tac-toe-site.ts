import { it, expect } from "bun:test";
import { eq } from "drizzle-orm";
import { Html } from "@elysiajs/html";
import { HTMLElement, HTMLButtonElement } from "happy-dom";

import { setupDocument } from "#/test/documents";
import { db } from "../db";
import { Lobby, User } from "../db/schema";
import { gameStates } from "../game/game-state";

import ActiveGameHtml from "./game-active";

const hardComputer = db.select().from(User).where(eq(User.id, 3)).get()!;
const debugUser = db.select().from(User).where(eq(User.id, 4)).get()!;

const activeLobby = db.select().from(Lobby).where(eq(Lobby.id, 2)).get()!;

it("matches active awake lobby for user with turn", async () => {
  using _state = gameStates.getOrCreate(activeLobby.id);
  const document = await setupDocument(
    await (<ActiveGameHtml lobby={activeLobby} user={debugUser} />),
  );
  gameStates.delete(activeLobby.id);

  const gameButtons = document.querySelectorAll(".game-board button");
  expect(gameButtons).toHaveLength(9);

  for (const button of gameButtons) {
    if (!(button instanceof HTMLButtonElement)) expect.unreachable();
    if (button.textContent === "") {
      expect(button.disabled).toBeFalse();
    } else {
      expect(button.disabled).toBeTrue();
    }
  }

  const lobbyStatus = document.querySelector("#lobby-status");
  if (!(lobbyStatus instanceof HTMLElement)) expect.unreachable();
  expect(lobbyStatus.dataset["status"]).toBe("active");
  expect(lobbyStatus.dataset["asleep"]).toBeUndefined();
});

it("matches active awake lobby for user without turn", async () => {
  using _state = gameStates.getOrCreate(activeLobby.id);
  const document = await setupDocument(
    await (<ActiveGameHtml lobby={activeLobby} user={hardComputer} />),
  );
  gameStates.delete(activeLobby.id);

  const gameButtons = document.querySelectorAll(".game-board button");
  expect(gameButtons).toHaveLength(9);

  for (const button of gameButtons) {
    if (!(button instanceof HTMLButtonElement)) expect.unreachable();
    expect(button.disabled).toBeTrue();
  }

  const lobbyStatus = document.querySelector("#lobby-status");
  if (!(lobbyStatus instanceof HTMLElement)) expect.unreachable();
  expect(lobbyStatus.dataset["status"]).toBe("active");
  expect(lobbyStatus.dataset["asleep"]).toBeUndefined();
});
