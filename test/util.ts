import { type Document } from "happy-dom";
import type { SelectLobby } from "#/src/db/schema";

import { db } from "#/src/db";
import {
  deleteLobbyById,
  insertFinishedLobby,
  insertGame,
  insertLobby,
} from "#/src/db/queries";
import { Game, Move } from "#/src/db/schema";
import { eq } from "drizzle-orm";
import { Browser } from "happy-dom";
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

function disposableLobby(lobby: SelectLobby) {
  return {
    ...lobby,
    [Symbol.dispose]() {
      db.delete(Move).where(eq(Move.lobbyId, this.id)).run();
      db.delete(Game).where(eq(Game.lobbyId, this.id)).run();
      deleteLobbyById.run({ id: this.id });
    },
  };
}

type ActiveLobbyProps = { playerX: number; playerO: number };
export function setupActiveLobby({ playerX, playerO }: ActiveLobbyProps) {
  const lobby = insertLobby.get({ userId: playerX, status: "active" })!;
  insertGame.run({ lobbyId: lobby.id, playerX, playerO });

  return disposableLobby({ ...lobby, status: "active", createdBy: playerX });
}

type FinishedLobbyProps = { playerX: number; playerO: number; winner?: number };
export function setupFinishedLobby({
  playerX,
  playerO,
  winner,
}: FinishedLobbyProps) {
  const lobby = insertLobby.get({ userId: playerX, status: "finished" })!;
  insertGame.run({ lobbyId: lobby.id, playerX, playerO });
  insertFinishedLobby.run({ lobbyId: lobby.id, winner });
  return disposableLobby({ ...lobby, status: "finished", createdBy: playerX });
}

export function setupWaitingLobby(userId: number) {
  const lobby = insertLobby.get({ userId, status: "waiting" })!;
  return disposableLobby({ ...lobby, status: "waiting", createdBy: userId });
}

export type DisposableLobby = ReturnType<typeof disposableLobby>;
