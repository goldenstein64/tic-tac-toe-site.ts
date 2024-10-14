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

export function GameListHead() {
  return (
    <head>
      <script src="./htmx.min.js"></script>
      <meta charset="UTF-8" />
    </head>
  );
}

async function UserConfig({ userId }: UserConfigProps) {
  const users = await selectUser.execute({ userId });
  const username = users.length > 0 ? users[0].username : "";
  return (
    <form hx-post="/api/user" hx-target="#username-result">
      <label for="set-username">Username: </label>
      <input id="set-username" value={username}></input>
      <input type="submit">Change</input>
      <div id="username-result"></div>
    </form>
  );
}

type WaitingGameItemProps = { lobbyId: number };

export function WaitingGameItem({ lobbyId }: WaitingGameItemProps) {
  return (
    <tr>
      <td>
        <button hx-delete={`/api/lobby?id=${lobbyId}`}>Forget</button>
      </td>
      <td>{lobbyId}</td>
    </tr>
  );
}

type ActiveGameItemProps = { lobbyId: number };

export function ActiveGameItem({ lobbyId }: ActiveGameItemProps) {
  return (
    <tr>
      <td>
        <button hx-get={`/api/lobby?id=${lobbyId}`}>Resume</button>
        <button hx-patch={`/api/lobby?id=${lobbyId}&action=forfeit`}>
          Forfeit
        </button>
      </td>
      <td>{lobbyId}</td>
    </tr>
  );
}

type AvailableGameItemProps = {
  lobbyId: number;
  opponent: number;
  createdAt: Date;
};

export function AvailableGameItem({
  lobbyId,
  opponent,
  createdAt,
}: AvailableGameItemProps) {
  return (
    <tr>
      <td>
        <button hx-patch={`/api/lobby?id=${lobbyId}&action=join`}>Join</button>
      </td>
      <td>{lobbyId}</td>
      <td>{createdAt.toUTCString()}</td>
      <td>{opponent}</td>
    </tr>
  );
}

export async function GameListBody({ userId }: GameListProps) {
  const availableGames = await selectAvailableGames.execute();
  return (
    <body>
      <h1>tic-tac-toe-site</h1>
      <button hx-post="/api/lobby">Create Game</button>
      <UserConfig userId={userId} />
      <h2>Waiting Games</h2>
      <table>
        <tr>
          <th>Actions</th>
          <th>Id</th>
        </tr>
      </table>
      <h2>Active Games</h2>
      <table>
        <tr>
          <th>Actions</th>
          <th>Id</th>
          <th>Opponent</th>
        </tr>
      </table>
      <h2>Available Games</h2>
      <table>
        <tr>
          <th>Actions</th>
          <th>Id</th>
          <th>Created At</th>
          <th>Opponent</th>
        </tr>
        {availableGames.map(AvailableGameItem)}
      </table>
    </body>
  );
}

type GameListProps = UserConfigProps;

export async function GameListHtml(props: GameListProps) {
  return (
    <html>
      <GameListHead />
      <GameListBody {...props} />
    </html>
  );
}
