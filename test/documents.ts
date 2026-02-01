import { type Document, Browser } from "happy-dom";
import { format } from "prettier";

export async function setupDocument(initial?: string): Promise<Document> {
  const browser = new Browser({
    // why did I do this again?
    settings: { disableJavaScriptFileLoading: true },
  });
  const page = browser.newPage();
  if (typeof initial === "string") {
    page.content = initial;
  }
  await browser.waitUntilComplete();
  return page.mainFrame.document;
}
export function getHTML(document: Document): Promise<string> {
  return format(document.documentElement.outerHTML, {
    parser: "html",
    htmlWhitespaceSensitivity: "strict",
  });
}
