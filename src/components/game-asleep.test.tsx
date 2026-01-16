import { it, expect } from "bun:test";
import { HTMLButtonElement, HTMLElement } from "happy-dom";
import { eq } from "drizzle-orm";
import { Html } from "@elysiajs/html";

import { setupDocument } from "#/test/util";
import { gameStates } from "../game/game-state";
import { db } from "../db";
import { User, Lobby } from "../db/schema";

import SleepingGameHtml from "./game-asleep";

const hardComputer = db.select().from(User).where(eq(User.id, 3)).get()!;
const debugUser = db.select().from(User).where(eq(User.id, 4)).get()!;

const activeLobby = db.select().from(Lobby).where(eq(Lobby.id, 2)).get()!;

it("matches active sleeping lobby for user with turn", async () => {
  const document = await setupDocument(
    await (<SleepingGameHtml lobby={activeLobby} user={debugUser} />)
  );

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

  const lobbyStatus = document.querySelector("#lobby-status")!;
  if (!(lobbyStatus instanceof HTMLElement)) expect.unreachable();
  expect(gameStates.has(activeLobby.id)).toBeFalse();
  expect(lobbyStatus.dataset["status"]).toBe("active");
  expect(lobbyStatus.dataset["asleep"]).toBe("");
});
it("matches active sleeping lobby for user without turn", async () => {
  const document = await setupDocument(
    await (<SleepingGameHtml lobby={activeLobby} user={hardComputer} />)
  );

  const gameButtons = document.querySelectorAll(
    ".game-board button"
  ) as Iterable<HTMLButtonElement>;

  for (const button of gameButtons) {
    if (!(button instanceof HTMLButtonElement)) expect.unreachable();
    expect(button.disabled).toBeTrue();
  }

  const lobbyStatus = document.querySelector("#lobby-status")!;
  if (!(lobbyStatus instanceof HTMLElement)) expect.unreachable();
  expect(gameStates.has(activeLobby.id)).toBeFalse();
  expect(lobbyStatus.dataset["status"]).toBe("active");
  expect(lobbyStatus.dataset["asleep"]).toBe("");
});
