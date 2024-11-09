import { Html } from "@elysiajs/html";
import { Game, Lobby, User } from "../db/schema";
import { db } from "../db";
import { eq, sql, aliasedTable, and } from "drizzle-orm";
import { UsernameHead, UsernameModal } from "./username-modal";

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
    .where(eq(Lobby.status, "active"))
    .prepare();
})();

const selectFinishedLobbies = (() => {
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
    .where(eq(Lobby.status, "finished"))
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
      <UsernameHead />
    </head>
  );
}

export async function UserConfig({ userId }: UserConfigProps) {
  const users = await selectUser.execute({ userId });
  const username = users.length > 0 ? users[0].username : "";
  return (
    <form id="user-config" hx-post="/api/username" hx-swap="none">
      <label for="username">Username: </label>
      <input
        type="text"
        class="username-input"
        name="username"
        value={username}
      />
      <button type="submit" class="username-submit">
        Change
      </button>
    </form>
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
      <td>{playerX}</td>
      <td>{playerO}</td>
    </tr>
  );
}

export async function ActiveLobbies() {
  const activeLobbies = await selectActiveLobbies.execute();
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
  playerX: string;
  playerO: string;
};

export function FinishedLobbyItem({
  lobbyId,
  playerX,
  playerO,
}: FinishedLobbyItemProps) {
  return (
    <tr>
      <td>
        <button>View</button>
      </td>
      <td>{lobbyId}</td>
      <td>{playerX}</td>
      <td>{playerO}</td>
    </tr>
  );
}

export async function FinishedLobbies() {
  const finishedLobbies = await selectFinishedLobbies.execute();
  return (
    <table>
      <thead>
        <tr>
          <td>Actions</td>
          <td>Id</td>
          <td>Created At</td>
          <td>Player X</td>
          <td>Player O</td>
        </tr>
      </thead>
      <tbody>{finishedLobbies.map(FinishedLobbyItem)}</tbody>
    </table>
  );
}

export async function LobbiesBody({ userId }: GameListProps) {
  return (
    <body>
      <h1>tic-tac-toe-site</h1>
      <button hx-on:click="location.href='/create-lobby'">Create Game</button>
      <UserConfig userId={userId} />
      <h2>Waiting Games</h2>
      <WaitingLobbies userId={userId} />
      <h2>Active Games</h2>
      <ActiveLobbies />
      <h2>Available Games</h2>
      <AvailableLobbies />
      <h2>Finished Games</h2>
      <FinishedLobbies />

      <UsernameModal />
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

export default LobbiesHtml;
