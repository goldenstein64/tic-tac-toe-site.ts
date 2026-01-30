import type { HTMLButtonElement } from "happy-dom";
import { HTMLElement } from "happy-dom";

import { it, expect } from "bun:test";
import { eq } from "drizzle-orm";
import { Html } from "@elysiajs/html";

import { db } from "../db";
import { Lobby, User } from "../db/schema";

import WaitingGameHtml from "./game-waiting";
import { setupDocument } from "#/test/util";

const debugUser = db.select().from(User).where(eq(User.id, 4)).get()!;
const waitingLobby = db.select().from(Lobby).where(eq(Lobby.id, 1)).get()!;

it("matches waiting lobby", async () => {
  const document = await setupDocument(
    await (<WaitingGameHtml lobby={waitingLobby} user={debugUser} />),
  );

  const gameButtons = document.querySelectorAll(
    ".game-board button",
  ) as Iterable<HTMLButtonElement>;

  for (const button of gameButtons) {
    expect(button.disabled).toBeTrue();
  }

  const lobbyStatus = document.querySelector("#lobby-status");
  if (!(lobbyStatus instanceof HTMLElement)) expect.unreachable();
  expect(lobbyStatus.dataset["status"]).toBe("waiting");
});
