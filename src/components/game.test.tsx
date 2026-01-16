import { describe, it, expect } from "bun:test";
import { eq } from "drizzle-orm";
import { Html } from "@elysiajs/html";
import { Browser, HTMLElement, HTMLButtonElement } from "happy-dom";
import Document from "happy-dom/lib/nodes/document/Document";

import WaitingGameHtml from "./game-waiting";
import FinishedGameHtml from "./game-finished";
import ActiveGameHtml from "./game-active";
import { db } from "../db";
import { Lobby, User } from "../db/schema";
import { gameStates } from "../game/game-state";
import SleepingGameHtml from "./game-asleep";

const hardComputer = db.select().from(User).where(eq(User.id, 3)).get()!;
const debugUser = db.select().from(User).where(eq(User.id, 4)).get()!;

const waitingLobby = db.select().from(Lobby).where(eq(Lobby.id, 1)).get()!;
const activeLobby = db.select().from(Lobby).where(eq(Lobby.id, 2)).get()!;
const finishedLobby = db.select().from(Lobby).where(eq(Lobby.id, 3)).get()!;

async function setUpPage(initial: string): Promise<Document> {
  const browser = new Browser({
    settings: { disableJavaScriptFileLoading: true },
  });
  const page = browser.newPage();
  page.content = initial;
  await browser.waitUntilComplete();
  return page.mainFrame.document;
}

describe("game.tsx", () => {
  it("matches waiting lobby", async () => {
    const document = await setUpPage(
      await (<WaitingGameHtml lobby={waitingLobby} user={debugUser} />)
    );

    const gameButtons = document.querySelectorAll(
      ".game-board button"
    ) as Iterable<HTMLButtonElement>;

    for (const button of gameButtons) {
      expect(button.disabled).toBeTrue();
    }
  });

  it("matches active awake lobby for user with turn", async () => {
    using _state = gameStates.getOrCreate(activeLobby.id);
    const document = await setUpPage(
      await (<ActiveGameHtml lobby={activeLobby} user={debugUser} />)
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
    const document = await setUpPage(
      await (<ActiveGameHtml lobby={activeLobby} user={hardComputer} />)
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

  it("matches active sleeping lobby for user with turn", async () => {
    const document = await setUpPage(
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
    const document = await setUpPage(
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

  it("matches finished lobby", async () => {
    const document = await setUpPage(
      await (<FinishedGameHtml lobby={finishedLobby} user={debugUser} />)
    );
    const gameButtons = document.querySelectorAll(
      ".game-board button"
    ) as Iterable<HTMLButtonElement>;

    for (const button of gameButtons) {
      if (!(button instanceof HTMLButtonElement)) expect.unreachable();
      expect(button.disabled).toBeTrue();
    }

    const lobbyStatus = document.querySelector("#lobby-status");
    if (!(lobbyStatus instanceof HTMLElement)) expect.unreachable();
    expect(lobbyStatus.dataset["status"]).toBe("finished");
  });
});
