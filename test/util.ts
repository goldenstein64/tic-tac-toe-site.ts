import { type Document, Browser } from "happy-dom";
import { SignJWT, jwtVerify } from "jose";
import { format } from "prettier";

const encoder = new TextEncoder();
const accessSecret = encoder.encode(Bun.env.JWT_ACCESS_SECRET);
const refreshSecret = encoder.encode(Bun.env.JWT_REFRESH_SECRET);

export function signAccess(payload: { userId: number }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .sign(accessSecret);
}

export function signRefresh(payload: { userId: number; refreshKey: number }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .sign(refreshSecret);
}

export function verifyAccess(signed: string) {
  return jwtVerify(signed, accessSecret);
}

export function verifyRefresh(signed: string) {
  return jwtVerify(signed, refreshSecret);
}

export async function setupDocument(initial: string): Promise<Document> {
  const browser = new Browser({
    settings: { disableJavaScriptFileLoading: true },
  });
  const page = browser.newPage();
  page.content = initial;
  await browser.waitUntilComplete();
  return page.mainFrame.document;
}
export function getHTML(document: Document): Promise<string> {
  return format(document.documentElement.outerHTML, {
    parser: "html",
    htmlWhitespaceSensitivity: "strict",
  });
}
