import { it, expect } from "bun:test";
import { HTMLButtonElement, HTMLElement } from "happy-dom";
import { eq } from "drizzle-orm";
import { Html } from "@elysiajs/html";

import { setupDocument } from "#/test/util";
import FinishedGameHtml from "./game-finished";
import { db } from "../db";
import { User, Lobby } from "../db/schema";

const debugUser = db.select().from(User).where(eq(User.id, 4)).get()!;

const finishedLobby = db.select().from(Lobby).where(eq(Lobby.id, 3)).get()!;

it("matches finished lobby", async () => {
  const document = await setupDocument(
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
