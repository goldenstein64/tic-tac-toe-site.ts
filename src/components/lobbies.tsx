import type { SelectUser } from "../db/schema";

import { Html } from "@elysiajs/html";

import {
  countUserActiveLobbies,
  countUserAvailableLobbies,
  countUserFinishedLobbies,
  countUserWaitingLobbies,
  selectUserActiveLobbies,
  selectUserAvailableLobbies,
  selectUserFinishedLobbies,
  selectUserWaitingLobbies,
} from "../db/queries";
import { DebugPanel } from "./debug";
import { SITE_TITLE } from "../constants";
import { TopNav, UserConfig, DefaultHtml } from "./base";

const PAGE_SIZE = 25;

type LobbyType = "waiting" | "available" | "active" | "finished";

type PaginatorProps = { type: LobbyType; page: number; count: number };
function Paginator({ type, page, count }: PaginatorProps) {
  // if (count === 1) {
  //   return null;
  // }

  const prevButton =
    page <= 1 ?
      <button disabled>&lt;</button>
    : <button
        hx-target="closest .paginator-target"
        hx-get="/api/lobbies"
        hx-vals={JSON.stringify({ type, page: page - 1 })}
      >
        &lt;
      </button>;

  const nextButton =
    page >= count ?
      <button disabled>&gt;</button>
    : <button
        hx-target="closest .paginator-target"
        hx-get="/api/lobbies"
        hx-vals={JSON.stringify({ type, page: page + 1 })}
      >
        &gt;
      </button>;

  return (
    <div class="paginator">
      {prevButton}
      <div class="page-number">
        {page} / {count}
      </div>
      {nextButton}
    </div>
  );
}

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

type WaitingLobbiesProps = { userId: number; page?: number };
export async function WaitingLobbies({
  userId,
  page = 1,
}: WaitingLobbiesProps) {
  const waitingLobbies = selectUserWaitingLobbies.all({
    userId,
    offset: PAGE_SIZE * (page - 1),
    limit: PAGE_SIZE,
  });
  const numWaiting = countUserWaitingLobbies.get({ userId })!.count;
  return (
    <div class="paginator-target">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Id</th>
            <th>Created At</th>
          </tr>
        </thead>
        <tbody>{waitingLobbies.map(WaitingLobbyItem)}</tbody>
      </table>
      <Paginator
        type="waiting"
        page={page}
        count={Math.ceil(numWaiting / PAGE_SIZE)}
      />
    </div>
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
          hx-patch="/api/lobby/forfeit"
          hx-swap="none"
          hx-vals={JSON.stringify({ id: lobbyId })}
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

type ActiveLobbiesProps = { userId: number; page?: number };
export async function ActiveLobbies({ userId, page = 1 }: ActiveLobbiesProps) {
  const activeLobbies = selectUserActiveLobbies.all({
    userId,
    offset: PAGE_SIZE * (page - 1),
    limit: PAGE_SIZE,
  });
  const numActive = countUserActiveLobbies.get({ userId })!.count;
  return (
    <div class="paginator-target">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Id</th>
            <th>Player X</th>
            <th>Player O</th>
          </tr>
        </thead>
        <tbody>{activeLobbies.map(ActiveLobbyItem)}</tbody>
      </table>
      <Paginator
        type="active"
        page={page}
        count={Math.ceil(numActive / PAGE_SIZE)}
      />
    </div>
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
          hx-patch="/api/lobby/join"
          hx-vals={JSON.stringify({ id: lobbyId })}
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

type AvailableLobbiesProps = { userId: number; page?: number };
export async function AvailableLobbies({
  userId,
  page = 1,
}: AvailableLobbiesProps) {
  const availableLobbies = selectUserAvailableLobbies.all({
    userId,
    offset: PAGE_SIZE * (page - 1),
    limit: PAGE_SIZE,
  });
  const numAvailable = countUserAvailableLobbies.get({ userId })!.count;
  return (
    <div class="paginator-target">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Id</th>
            <th>Created At</th>
            <th>Opponent</th>
          </tr>
        </thead>
        <tbody>{availableLobbies.map(AvailableLobbyItem)}</tbody>
      </table>
      <Paginator
        type="available"
        page={page}
        count={Math.ceil(numAvailable / PAGE_SIZE)}
      />
    </div>
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

type FinishedLobbiesProps = { userId: number; page?: number };

/** a table of the user's finished lobbies */
export async function FinishedLobbies({
  userId,
  page = 1,
}: FinishedLobbiesProps) {
  const finishedLobbies = selectUserFinishedLobbies.all({
    userId,
    offset: PAGE_SIZE * (page - 1),
    limit: PAGE_SIZE,
  });
  const numFinished = countUserFinishedLobbies.get({ userId })!.count;
  return (
    <div class="paginator-target">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Id</th>
            <th>Created At</th>
            <th>Finished At</th>
            <th>Player X</th>
            <th>Player O</th>
          </tr>
        </thead>
        <tbody>{finishedLobbies.map(FinishedLobbyItem)}</tbody>
      </table>
      <Paginator
        type="finished"
        page={page}
        count={Math.ceil(numFinished / PAGE_SIZE)}
      />
    </div>
  );
}

export async function LobbiesBody({ user }: LobbiesProps) {
  const userId = user.id;
  return (
    <body>
      <header>
        <DebugPanel />
        <TopNav>
          <button type="button" hx-on-click="location.href='/new-lobby'">
            New Lobby
          </button>
          <div class="flex-fill" />
          <UserConfig user={user} />
        </TopNav>
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
    <DefaultHtml>
      <LobbiesHead />
      <LobbiesBody {...props} />
    </DefaultHtml>
  );
}

export default LobbiesHtml;
