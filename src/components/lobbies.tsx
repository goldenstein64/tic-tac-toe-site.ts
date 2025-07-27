import type { SelectUser } from "../db/schema";

import { Html } from "@elysiajs/html";

import {
  selectUserActiveLobbies,
  selectUserAvailableLobbies,
  selectUserFinishedLobbies,
  selectUserWaitingLobbies,
} from "../db/queries";
import { DebugPanel } from "./debug";
import { SITE_TITLE } from "../constants";

export function LobbiesHead() {
  return (
    <head>
      <title>{SITE_TITLE} - Lobbies</title>
      <script src="/public/client/lobby.js" type="module" />
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="/public/global.css" />
      <link rel="stylesheet" href="/public/lobbies.css" />
    </head>
  );
}

export async function UserConfig({ user }: { user: SelectUser }) {
  return (
    <section id="user-config">
      <span>{user.username} </span>
      <button
        type="button"
        hx-delete="/api/session"
        hx-swap="none"
        hx-on--after-request="location.href='/login'"
      >
        Log out
      </button>
    </section>
  );
}

type WaitingLobbyItemProps = { lobbyId: number; createdAt: Date };

export function WaitingLobbyItem({
  lobbyId,
  createdAt,
}: WaitingLobbyItemProps) {
  return (
    <tr>
      <td class="actions">
        <button
          type="button"
          hx-on-click={`location.href="/game?id=${lobbyId}"`}
        >
          View
        </button>
        <button
          type="button"
          hx-delete="/api/lobby"
          hx-vals={JSON.stringify({ id: lobbyId })}
        >
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
  const waitingLobbies = selectUserWaitingLobbies.all({ userId });
  return (
    <table>
      <thead>
        <tr>
          <td></td>
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
      <td class="actions">
        <button
          type="button"
          hx-on-click={`location.href="/game?id=${lobbyId}"`}
        >
          View
        </button>
        <button
          type="button"
          hx-patch="/api/lobby"
          hx-vals={JSON.stringify({ id: lobbyId, action: "forfeit" })}
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
  const activeLobbies = selectUserActiveLobbies.all({ userId });
  return (
    <table>
      <thead>
        <tr>
          <td></td>
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
  opponent: string;
  createdAt: Date;
};

export function AvailableLobbyItem({
  lobbyId,
  opponent,
  createdAt,
}: AvailableLobbyItemProps) {
  return (
    <tr>
      <td class="actions">
        <button
          type="button"
          hx-on-click={`location.href="/game?id=${lobbyId}"`}
        >
          View
        </button>
        <button
          type="button"
          hx-patch="/api/lobby"
          hx-vals={JSON.stringify({ id: lobbyId, action: "join" })}
          hx-swap="none"
          hx-on--after-request={`location.href="/game?id=${lobbyId}"`}
        >
          Join
        </button>
      </td>
      <td>{lobbyId}</td>
      <td>{createdAt.toUTCString()}</td>
      <td>{opponent}</td>
    </tr>
  );
}

type AvailableLobbiesProps = { userId: number };
export async function AvailableLobbies({ userId }: AvailableLobbiesProps) {
  const availableLobbies = selectUserAvailableLobbies.all({ userId });
  return (
    <table>
      <thead>
        <tr>
          <td></td>
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
      <td class="actions">
        <button
          type="button"
          hx-on-click={`location.href="/game?id=${lobbyId}"`}
        >
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
  const finishedLobbies = selectUserFinishedLobbies.all({ userId });
  return (
    <table>
      <thead>
        <tr>
          <td></td>
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
      <header>
        <DebugPanel />
        <h1>{SITE_TITLE}</h1>
        <button type="button" hx-on-click="location.href='/new-lobby'">
          New Lobby
        </button>
        <UserConfig user={user} />
        <nav>
          <button type="button" hx-on-click="location.hash='#active-games'">
            Active Games
          </button>
          <button type="button" hx-on-click="location.hash='#available-games'">
            Available Games
          </button>
          <button type="button" hx-on-click="location.hash='#waiting-games'">
            Waiting Games
          </button>
          <button type="button" hx-on-click="location.hash='#finished-games'">
            Finished Games
          </button>
        </nav>
      </header>
      <main>
        <section id="active-games">
          <h2>Active Games</h2>
          <ActiveLobbies userId={userId} />
        </section>
        <section id="available-games">
          <h2>Available Games</h2>
          <AvailableLobbies userId={userId} />
        </section>
        <section id="waiting-games">
          <h2>Waiting Games</h2>
          <WaitingLobbies userId={userId} />
        </section>
        <section id="finished-games">
          <h2>Finished Games</h2>
          <FinishedLobbies userId={userId} />
        </section>
      </main>
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
