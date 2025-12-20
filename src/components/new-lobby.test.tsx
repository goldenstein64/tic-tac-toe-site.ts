import { describe, it, expect } from "bun:test";
import { Html } from "@elysiajs/html";
import { eq } from "drizzle-orm";

import { NewLobbyHtml } from "./new-lobby";
import { db } from "../db";
import { User } from "../db/schema";

import { format } from "prettier";
import { Browser } from "happy-dom";
import Document from "happy-dom/lib/nodes/document/Document";

const debugUser = db.select().from(User).where(eq(User.id, 4)).get()!;

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

describe("new-lobby.tsx", () => {
  it("matches new lobby", async () => {
    const document = await setUpPage(await (<NewLobbyHtml user={debugUser} />));
    expect(await getHTML(document)).toMatchSnapshot();
  });
});
