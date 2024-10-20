import { Html } from "@elysiajs/html";
import { ActiveLobby, Lobby, User } from "../db/schema";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";

const selectActiveGames = db
  .select({ lobbyId: Lobby.id })
  .from(Lobby)
  .innerJoin(ActiveLobby, eq(ActiveLobby.id, Lobby.id))
  .where(eq(Lobby.status, "active"))
  .prepare();

const selectAvailableGames = db
  .select({
    lobbyId: Lobby.id,
    opponent: Lobby.createdBy,
    createdAt: Lobby.createdAt,
  })
  .from(Lobby)
  .where(eq(Lobby.status, "waiting"))
  .prepare();

const selectUser = db
  .select({ username: User.username })
  .from(User)
  .where(eq(User.id, sql.placeholder("userId")))
  .prepare();

type UserConfigProps = { userId: number };

export function LobbiesHead() {
  return (
    <head>
      <script src="/public/htmx.min.js" />
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
  );
}

async function UserConfig({ userId }: UserConfigProps) {
  const users = await selectUser.execute({ userId });
  const username = users.length > 0 ? users[0].username : "";
  return (
    <form hx-post="/api/user">
      <label for="set-username">Username: </label>
      <input
        hx-select="#set-username"
        hx-swap="outerHTML"
        id="set-username"
        value={username}
      />
      <input type="submit">Change</input>
      <div
        hx-select="#username-result"
        hx-swap="outerHTML"
        id="username-result"
      />
    </form>
  );
}

type WaitingLobbyItemProps = { lobbyId: number };

export function WaitingLobbyItem({ lobbyId }: WaitingLobbyItemProps) {
  return (
    <tr>
      <td>
        <button hx-delete="/api/lobby" hx-vals={{ id: lobbyId }}>
          Forget
        </button>
      </td>
      <td>{lobbyId}</td>
    </tr>
  );
}

export async function WaitingLobbies() {
  return (
    <table>
      <thead>
        <tr>
          <td>Actions</td>
          <td>Id</td>
        </tr>
      </thead>
      <tbody />
    </table>
  );
}

type ActiveLobbyItemProps = { lobbyId: number };

export function ActiveLobbyItem({ lobbyId }: ActiveLobbyItemProps) {
  return (
    <tr>
      <td>
        <button hx-on:click={`location.href='/game?id=${lobbyId}'`}>
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
    </tr>
  );
}

export async function ActiveLobbies() {
  return (
    <table>
      <thead>
        <tr>
          <td>Actions</td>
          <td>Id</td>
          <td>Opponent</td>
        </tr>
      </thead>
      <tbody />
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
  const availableLobbies = await selectAvailableGames.execute();
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

export async function LobbiesBody({ userId }: GameListProps) {
  return (
    <body>
      <h1>tic-tac-toe-site</h1>
      <button hx-on:click="location.href='/create-game'">Create Game</button>
      <UserConfig userId={userId} />
      <h2>Waiting Games</h2>
      <WaitingLobbies />
      <h2>Active Games</h2>
      <ActiveLobbies />
      <h2>Available Games</h2>
      <AvailableLobbies />
    </body>
  );
}

type GameListProps = UserConfigProps;

export async function LobbiesHtml(props: GameListProps) {
  return (
    <html>
      <LobbiesHead />
      <LobbiesBody {...props} />
    </html>
  );
}
