import { describe, it, expect } from "bun:test";
import { eq } from "drizzle-orm";
import { Html } from "@elysiajs/html";
import { format } from "prettier";
import { Browser } from "happy-dom";
import Document from "happy-dom/lib/nodes/document/Document";

import WaitingGameHtml from "./game-waiting";
import FinishedGameHtml from "./game-finished";
import ActiveGameHtml from "./game-active";
import { db } from "../db";
import { Lobby, User } from "../db/schema";

const debugUser = db.select().from(User).where(eq(User.id, 4)).get()!;

const waitingLobby = db.select().from(Lobby).where(eq(Lobby.id, 1)).get()!;
const activeLobby = db.select().from(Lobby).where(eq(Lobby.id, 2)).get()!;
const finishedLobby = db.select().from(Lobby).where(eq(Lobby.id, 3)).get()!;

function getHTML(document: Document): Promise<string> {
  return format(document.documentElement.outerHTML, {
    parser: "html",
    htmlWhitespaceSensitivity: "strict",
  });
}

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
    expect(await getHTML(document)).toMatchSnapshot();

    const gameButtons = document.querySelectorAll(
      ".game-board > button.game-button"
    ) as Iterable<HTMLButtonElement>;

    for (const gameButton of gameButtons) {
      expect(gameButton.disabled).toBeTrue();
    }
  });

  it("matches active lobby", async () => {
    const document = await setUpPage(
      await (<ActiveGameHtml lobby={activeLobby} user={debugUser} />)
    );
    expect(await getHTML(document)).toMatchSnapshot();
  });

  it.todo("matches active awake lobby for user with turn", () => {});
  it.todo("matches active sleeping lobby for user with turn", () => {});
  it.todo("matches active sleeping lobby for user without turn", () => {});

  it("matches finished lobby", async () => {
    const document = await setUpPage(
      await (<FinishedGameHtml lobby={finishedLobby} user={debugUser} />)
    );
    expect(await getHTML(document)).toMatchSnapshot();

    const gameButtons = document.querySelectorAll(
      ".game-board > button.game-button"
    ) as Iterable<HTMLButtonElement>;

    for (const gameButton of gameButtons) {
      expect(gameButton.disabled).toBeTrue();
    }
  });
});
