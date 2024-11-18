import type { SelectUser } from "../db/schema";

import { Html } from "@elysiajs/html";
import { FinishedLobby, Game, Lobby, User } from "../db/schema";
import { db } from "../db";
import { eq, sql, aliasedTable, and, or } from "drizzle-orm";

const selectActiveLobbies = (() => {
  const playerX = aliasedTable(User, "playerX");
  const playerO = aliasedTable(User, "playerO");
  return db
    .select({
      lobbyId: Lobby.id,
      playerX: playerX.username,
      playerO: playerO.username,
    })
    .from(Lobby)
    .innerJoin(Game, eq(Game.lobbyId, Lobby.id))
    .innerJoin(playerX, eq(playerX.id, Game.playerX))
    .innerJoin(playerO, eq(playerO.id, Game.playerO))
    .where(
      and(
        eq(Lobby.status, "active"),
        or(
          eq(playerX.id, sql.placeholder("userId")),
          eq(playerO.id, sql.placeholder("userId"))
        )
      )
    )
    .prepare();
})();

const selectFinishedLobbies = (() => {
  const playerX = aliasedTable(User, "playerX");
  const playerO = aliasedTable(User, "playerO");
  return db
    .select({
      lobbyId: Lobby.id,
      createdAt: Lobby.createdAt,
      finishedAt: FinishedLobby.finishedAt,
      playerX: playerX.username,
      playerO: playerO.username,
    })
    .from(Lobby)
    .innerJoin(FinishedLobby, eq(FinishedLobby.id, Lobby.id))
    .innerJoin(Game, eq(Game.lobbyId, Lobby.id))
    .innerJoin(playerX, eq(playerX.id, Game.playerX))
    .innerJoin(playerO, eq(playerO.id, Game.playerO))
    .where(
      and(
        eq(Lobby.status, "finished"),
        or(
          eq(playerX.id, sql.placeholder("userId")),
          eq(playerO.id, sql.placeholder("userId"))
        )
      )
    )
    .prepare();
})();

const selectAvailableLobbies = db
  .select({
    lobbyId: Lobby.id,
    opponent: Lobby.createdBy,
    createdAt: Lobby.createdAt,
  })
  .from(Lobby)
  .where(eq(Lobby.status, "waiting"))
  .prepare();

const selectWaitingLobbies = db
  .select({
    lobbyId: Lobby.id,
    createdAt: Lobby.createdAt,
  })
  .from(Lobby)
  .where(
    and(
      eq(Lobby.status, "waiting"),
      eq(Lobby.createdBy, sql.placeholder("userId"))
    )
  )
  .prepare();

export function LobbiesHead() {
  return (
    <head>
      <script src="/public/htmx.min.js" />
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
  );
}

export async function UserConfig() {
  return (
    <div>
      <button hx-delete="/api/session" hx-swap="none">
        Log out
      </button>
    </div>
  );
}

type WaitingLobbyItemProps = { lobbyId: number; createdAt: Date };

export function WaitingLobbyItem({
  lobbyId,
  createdAt,
}: WaitingLobbyItemProps) {
  return (
    <tr>
      <td>
        <button hx-delete="/api/lobby" hx-vals={{ id: lobbyId }}>
          Forget
        </button>
      </td>
      <td>{lobbyId}</td>
      <td>{createdAt.toUTCString()}</td>
    </tr>
  );
}

type WaitingLobbiesProps = { userId: number };

export async function WaitingLobbies({ userId }: WaitingLobbiesProps) {
  const waitingLobbies = await selectWaitingLobbies.execute({ userId });
  return (
    <table>
      <thead>
        <tr>
          <td>Actions</td>
          <td>Id</td>
          <td>Created At</td>
        </tr>
      </thead>
      <tbody>{waitingLobbies.map(WaitingLobbyItem)}</tbody>
    </table>
  );
}

type ActiveLobbyItemProps = {
  lobbyId: number;
  playerX: string;
  playerO: string;
};

export function ActiveLobbyItem({
  lobbyId,
  playerX,
  playerO,
}: ActiveLobbyItemProps) {
  return (
    <tr>
      <td>
        <button hx-on:click={`location.href="/game?id=${lobbyId}"`}>
          Resume
        </button>
        <button
          hx-patch="/api/lobby"
          hx-vals={{ id: lobbyId, action: "forfeit" }}
        >
          Forfeit
        </button>
      </td>
      <td>{lobbyId}</td>
      <td>{playerX}</td>
      <td>{playerO}</td>
    </tr>
  );
}

type ActiveLobbiesProps = { userId: number };

export async function ActiveLobbies({ userId }: ActiveLobbiesProps) {
  const activeLobbies = await selectActiveLobbies.execute({ userId });
  return (
    <table>
      <thead>
        <tr>
          <td>Actions</td>
          <td>Id</td>
          <td>Player X</td>
          <td>Player O</td>
        </tr>
      </thead>
      <tbody>{activeLobbies.map(ActiveLobbyItem)}</tbody>
    </table>
  );
}

type AvailableLobbyItemProps = {
  lobbyId: number;
  opponent: number;
  createdAt: Date;
};

export function AvailableLobbyItem({
  lobbyId,
  opponent,
  createdAt,
}: AvailableLobbyItemProps) {
  return (
    <tr>
      <td>
        <button hx-patch="/api/lobby" hx-vals={{ id: lobbyId, action: "join" }}>
          Join
        </button>
      </td>
      <td>{lobbyId}</td>
      <td>{createdAt.toUTCString()}</td>
      <td>{opponent}</td>
    </tr>
  );
}

export async function AvailableLobbies() {
  const availableLobbies = await selectAvailableLobbies.execute();
  return (
    <table>
      <thead>
        <tr>
          <td>Actions</td>
          <td>Id</td>
          <td>Created At</td>
          <td>Opponent</td>
        </tr>
      </thead>
      <tbody>{availableLobbies.map(AvailableLobbyItem)}</tbody>
    </table>
  );
}

type FinishedLobbyItemProps = {
  lobbyId: number;
  createdAt: Date;
  finishedAt: Date;
  playerX: string;
  playerO: string;
};

/** a row in the finished lobbies table */
export function FinishedLobbyItem({
  lobbyId,
  createdAt,
  finishedAt,
  playerX,
  playerO,
}: FinishedLobbyItemProps) {
  return (
    <tr>
      <td>
        <button hx-on:click={`location.href="/game?id=${lobbyId}"`}>
          View
        </button>
      </td>
      <td>{lobbyId}</td>
      <td>{createdAt.toUTCString()}</td>
      <td>{finishedAt.toUTCString()}</td>
      <td>{playerX}</td>
      <td>{playerO}</td>
    </tr>
  );
}

type FinishedLobbiesProps = { userId: number };

/** a table of the user's finished lobbies */
export async function FinishedLobbies({ userId }: FinishedLobbiesProps) {
  const finishedLobbies = await selectFinishedLobbies.execute({ userId });
  return (
    <table>
      <thead>
        <tr>
          <td>Actions</td>
          <td>Id</td>
          <td>Created At</td>
          <td>Finished At</td>
          <td>Player X</td>
          <td>Player O</td>
        </tr>
      </thead>
      <tbody>{finishedLobbies.map(FinishedLobbyItem)}</tbody>
    </table>
  );
}

export async function LobbiesBody({ user }: LobbiesProps) {
  const userId = user.id;
  return (
    <body>
      <h1>tic-tac-toe-site</h1>
      <button hx-on:click="location.href='/new-lobby'">New Lobby</button>
      <UserConfig />
      <h2>Waiting Games</h2>
      <WaitingLobbies userId={userId} />
      <h2>Active Games</h2>
      <ActiveLobbies userId={userId} />
      <h2>Available Games</h2>
      <AvailableLobbies />
      <h2>Finished Games</h2>
      <FinishedLobbies userId={userId} />
    </body>
  );
}

type LobbiesProps = { user: SelectUser };

export async function LobbiesHtml(props: LobbiesProps) {
  return (
    <html>
      <LobbiesHead />
      <LobbiesBody {...props} />
    </html>
  );
}

export default LobbiesHtml;
