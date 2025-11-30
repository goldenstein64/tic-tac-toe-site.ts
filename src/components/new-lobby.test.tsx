import type DetachedWindowAPI from "happy-dom/lib/window/DetachedWindowAPI";

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "bun:test";
import { Html } from "@elysiajs/html";
import { eq } from "drizzle-orm";

import { NewLobbyHtml } from "./new-lobby";
import { db } from "../db";
import { User } from "../db/schema";

import { format } from "prettier";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

const debugUser = db.select().from(User).where(eq(User.id, 4)).get()!;

declare const happyDOM: DetachedWindowAPI;

function getHTML(document: Document): Promise<string> {
  return format(document.documentElement.outerHTML, {
    parser: "html",
    htmlWhitespaceSensitivity: "strict",
  });
}

beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());

beforeEach(() => document.open());
afterEach(() => document.close());

describe("new-lobby.tsx", () => {
  it("matches new lobby", async () => {
    document.write(await (<NewLobbyHtml user={debugUser} />));
    await happyDOM.waitUntilComplete();
    expect(await getHTML(document)).toMatchSnapshot();
  });
});
