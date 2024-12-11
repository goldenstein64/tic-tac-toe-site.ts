import type { Mark } from "@goldenstein64/tic-tac-toe";

import { Html } from "@elysiajs/html";
import { eq, sql } from "drizzle-orm";

import { db, typePrepared } from "../db";
import {
  FinishedLobby,
  Move,
  SelectLobby,
  SelectUser,
  User,
} from "../db/schema";
import { orderingToMark } from "../libs/run-game";
import { DebugPanel } from "./debug";
import { COLUMN_LABELS, ROW_LABELS } from "./game-active";
import {
  PlayerInfo,
  GameHead,
  selectUserById,
  selectPlayersInGame,
} from "./game-base";

const _placeholders: any = undefined;

const selectGameMoves = typePrepared(
  db
    .select({ position: Move.position, ordering: Move.ordering })
    .from(Move)
    .where(eq(Move.lobbyId, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number }
);

const selectFinishedLobby = typePrepared(
  db
    .select()
    .from(FinishedLobby)
    .where(eq(FinishedLobby.id, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number }
);

const selectUsername = typePrepared(
  db
    .select({ username: User.username })
    .from(User)
    .where(eq(User.id, sql.placeholder("userId")))
    .prepare(),
  _placeholders as { userId: number }
);

type GameButtonProps = { children?: Mark; ariaLabel: string };

function GameButton({ children: mark, ariaLabel }: GameButtonProps) {
  return (
    <button
      type="button"
      disabled
      aria-label={ariaLabel}
      class={[mark === "X" && "mark-x", mark === "O" && "mark-o"]}
    >
      {mark}
    </button>
  );
}

type GameRowProps = {
  start: number;
  moves: Map<number, number>;
  ariaLabel: string;
};

function GameRow({ start, moves, ariaLabel: rowLabel }: GameRowProps) {
  return (
    <tr>
      {COLUMN_LABELS.map((colLabel, i) => {
        const ordering = moves.get(i + start);
        const mark =
          ordering !== undefined ? orderingToMark(ordering) : undefined;
        return (
          <td>
            <GameButton ariaLabel={`${rowLabel}-${colLabel}`}>
              {mark}
            </GameButton>
          </td>
        );
      })}
    </tr>
  );
}

function GameBoard({ lobby }: { lobby: SelectLobby }) {
  const movesArray = selectGameMoves.all({ lobbyId: lobby.id });
  const moves = new Map<number, number>(
    movesArray.map(({ position, ordering }) => [position, ordering])
  );

  return (
    <table class="game-board">
      <tbody>
        {ROW_LABELS.map((label, i) => {
          return <GameRow start={i * 3} moves={moves} ariaLabel={label} />;
        })}
      </tbody>
    </table>
  );
}

type GameBodyProps = { lobby: SelectLobby; user: SelectUser };

function GameBody({ lobby, user }: GameHtmlProps) {
  let opponent: SelectUser | undefined = undefined;
  if (lobby.status !== "waiting") {
    const { playerX, playerO } = selectPlayersInGame.get({
      lobbyId: lobby.id,
    })!;
    const opponentId = user.id === playerX ? playerO : playerX;
    opponent = selectUserById.get({ userId: opponentId });
  }

  const finishedLobby = selectFinishedLobby.get({ lobbyId: lobby.id });
  const winnerId = finishedLobby?.winner;

  let winnerName: string | undefined = undefined;
  if (winnerId === null) {
    winnerName = "no one";
  } else if (winnerId !== undefined) {
    const winner = selectUsername.get({ userId: winnerId });
    winnerName = winner?.username;
  }

  return (
    <body>
      <header>
        <DebugPanel />
        <h1>tic-tac-toe-site</h1>
        <h3 id="lobby-status">Status: {lobby.status}</h3>
        <h3 id="lobby-winner">Winner: {winnerName}</h3>
      </header>
      <main>
        <PlayerInfo user={user} />
        <GameBoard lobby={lobby} />
        <PlayerInfo user={opponent} />
      </main>
    </body>
  );
}

type GameHtmlProps = GameBodyProps;

export function GameHtml(props: GameHtmlProps) {
  return (
    <html>
      <GameHead />
      <GameBody {...props} />
    </html>
  );
}

export default GameHtml;
