import { db } from "#/src/db";
import {
  deleteLobbyById,
  insertLobby,
  insertGame,
  insertFinishedLobby,
} from "#/src/db/queries";
import { type SelectLobby, Move, Game } from "#/src/db/schema";
import { eq } from "drizzle-orm";

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
