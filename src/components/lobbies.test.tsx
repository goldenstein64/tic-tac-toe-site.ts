import { describe, it, expect } from "bun:test";
import { Html } from "@elysiajs/html";

import LobbiesHtml from "./lobbies";
import { setupDocument, getHTML } from "#/test/util";
import { selectUserById } from "../db/queries";

const debugUser = selectUserById.get({ userId: 4 })!;

describe("GET /", () => {
  it("matches snapshot", async () => {
    const document = await setupDocument(
      await (<LobbiesHtml user={debugUser} />),
    );
    expect(await getHTML(document)).toMatchSnapshot();
  });
});
