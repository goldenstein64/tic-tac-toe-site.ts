import { it, expect } from "bun:test";
import { Html } from "@elysiajs/html";

import LoginHtml from "./login";
import { setupDocument, getHTML } from "#/test/util";

it("matches snapshot", async () => {
  const document = await setupDocument(await (<LoginHtml />));
  expect(await getHTML(document)).toMatchSnapshot();
});
