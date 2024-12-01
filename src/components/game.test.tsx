/// <reference lib="dom" />
import type DetachedWindowAPI from "happy-dom/lib/window/DetachedWindowAPI";

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { eq } from "drizzle-orm";
import { Html } from "@elysiajs/html";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

import DormantGameHtml from "./game-dormant";
import ActiveGameHtml from "./game-active";
import { db } from "../db";
import { Lobby, User } from "../db/schema";
import { format } from "prettier";

const debugUser = db.select().from(User).where(eq(User.id, 4)).get()!;

const waitingLobby = db.select().from(Lobby).where(eq(Lobby.id, 1)).get()!;
const activeLobby = db.select().from(Lobby).where(eq(Lobby.id, 2)).get()!;
const finishedLobby = db.select().from(Lobby).where(eq(Lobby.id, 3)).get()!;

declare const happyDOM: DetachedWindowAPI;

function getHTML(document: Document): Promise<string> {
  return format(document.documentElement.outerHTML, {
    parser: "html",
    htmlWhitespaceSensitivity: "strict",
  });
}

describe("game.tsx", () => {
  beforeEach(() => GlobalRegistrator.register());

  afterEach(() => GlobalRegistrator.unregister());

  it("matches waiting lobby", async () => {
    document.write(
      await (<DormantGameHtml lobby={waitingLobby} user={debugUser} />)
    );
    await happyDOM.waitUntilComplete();
    expect(await getHTML(document)).toMatchSnapshot();
  });

  it("matches active lobby", async () => {
    document.write(
      await (<ActiveGameHtml lobby={activeLobby} user={debugUser} />)
    );
    await happyDOM.waitUntilComplete();
    expect(await getHTML(document)).toMatchSnapshot();
  });

  it("matches finished lobby", async () => {
    document.write(
      await (<DormantGameHtml lobby={finishedLobby} user={debugUser} />)
    );
    await happyDOM.waitUntilComplete();
    expect(await getHTML(document)).toMatchSnapshot();

    const gameButtonList = document.querySelectorAll<HTMLButtonElement>(
      ".game-board > button.game-button"
    );

    for (const gameButton of gameButtonList) {
      expect(gameButton.disabled).toBeTrue();
    }
  });
});
