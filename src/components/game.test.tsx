/// <reference lib="dom" />
import type DetachedWindowAPI from "happy-dom/lib/window/DetachedWindowAPI";

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { eq } from "drizzle-orm";
import { Html } from "@elysiajs/html";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

import GameHtml from "./game";
import { db } from "../db";
import { User } from "../db/schema";
import { format } from "prettier";

const debugUser = db.select().from(User).where(eq(User.id, 4)).get()!;

const WAITING_LOBBY_ID = 1;
const ACTIVE_LOBBY_ID = 2;
const FINISHED_LOBBY_ID = 3;

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
      await (<GameHtml lobbyId={WAITING_LOBBY_ID} user={debugUser} />)
    );
    await happyDOM.waitUntilComplete();
    expect(await getHTML(document)).toMatchSnapshot();
  });

  it("matches active lobby", async () => {
    document.write(
      await (<GameHtml lobbyId={ACTIVE_LOBBY_ID} user={debugUser} />)
    );
    await happyDOM.waitUntilComplete();
    expect(await getHTML(document)).toMatchSnapshot();
  });

  it("matches finished lobby", async () => {
    document.write(
      await (<GameHtml lobbyId={FINISHED_LOBBY_ID} user={debugUser} />)
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
