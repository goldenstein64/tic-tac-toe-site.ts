import { describe, it, expect } from "bun:test";
import { Html } from "@elysiajs/html";
import { eq } from "drizzle-orm";

import { NewLobbyHtml } from "./new-lobby";
import { db } from "../db";
import { User } from "../db/schema";

import { getHTML, setupDocument } from "#/test/util";

const debugUser = db.select().from(User).where(eq(User.id, 4)).get()!;

describe("new-lobby.tsx", () => {
  it("matches new lobby", async () => {
    const document = await setupDocument(
      await (<NewLobbyHtml user={debugUser} csrfToken="something" />)
    );
    expect(await getHTML(document)).toMatchSnapshot();
  });
});
