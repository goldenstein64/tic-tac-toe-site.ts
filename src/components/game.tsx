import type { Board, Mark } from "@goldenstein64/tic-tac-toe/lib";

import { Html } from "@elysiajs/html";
import { eq, sql } from "drizzle-orm";

import { db, typePrepared } from "../db";
import {
  FinishedLobby,
  Game,
  Lobby,
  SelectLobby,
  Move,
  SelectUser,
  User,
} from "../db/schema";
import { DebugPanel } from "./debug";
import { orderingToMark } from "../libs/run-game";

const COLUMN_LABELS = ["left", "center", "right"] as const;
const ROW_LABELS = ["Top", "Middle", "Bottom"] as const;

const _placeholders: any = undefined;

const selectGameMoves = typePrepared(
  db
    .select({ position: Move.position, ordering: Move.ordering })
    .from(Move)
    .where(eq(Move.lobbyId, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number }
);

const selectLobby = typePrepared(
  db
    .select()
    .from(Lobby)
    .where(eq(Lobby.id, sql.placeholder("lobbyId")))
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

const selectUser = typePrepared(
  db
    .select()
    .from(User)
    .where(eq(User.id, sql.placeholder("userId")))
    .prepare(),
  _placeholders as { userId: number }
);

const selectUsername = typePrepared(
  db
    .select({ username: User.username })
    .from(User)
    .where(eq(User.id, sql.placeholder("userId")))
    .prepare(),
  _placeholders as { userId: number }
);

const selectPlayersInGame = typePrepared(
  db
    .select({ playerX: Game.playerX, playerO: Game.playerO })
    .from(Game)
    .where(eq(Game.lobbyId, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number }
);

export function GameHead() {
  return (
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <script src="/public/htmx.min.js" />
      <script src="/public/htmx-ext-sse.js" />
      <link rel="stylesheet" href="/public/global.css" />
      <link rel="stylesheet" href="/public/game.css" />
    </head>
  );
}

type GameButtonProps = {
  disabled?: boolean;
  lobbyId: number;
  position: number;
  ariaLabel: string;
  children?: Mark;
};

export function ActiveGameButton({
  disabled = false,
  lobbyId,
  position,
  children: mark,
  ariaLabel: label,
}: GameButtonProps) {
  const hxVals = JSON.stringify({ id: lobbyId, position });
  return (
    <button
      type="button"
      hx-post="/api/game-move"
      hx-swap="none"
      hx-vals={hxVals}
      disabled={disabled || Boolean(mark)}
      aria-label={label}
    >
      {mark}
    </button>
  );
}

type GameRowProps = {
  lobbyId: number;
  start: number;
  moves: Map<number, number>;
  ariaLabel: string;
  disabled?: boolean;
};

function ActiveGameRow({
  lobbyId,
  start,
  moves,
  ariaLabel: rowLabel,
  disabled,
}: GameRowProps) {
  const buttons = COLUMN_LABELS.map((colLabel, i) => {
    const ordering = moves.get(i + start);
    const mark = ordering ? orderingToMark(ordering) : undefined;
    return (
      <td>
        <ActiveGameButton
          lobbyId={lobbyId}
          position={i + start}
          ariaLabel={`${rowLabel}-${colLabel}`}
          disabled={disabled}
        >
          {mark}
        </ActiveGameButton>
      </td>
    );
  });
  return <tr>{buttons}</tr>;
}

type ActiveGameRowsProps = {
  lobbyId: number;
  board: Board;
  disabled?: boolean;
};

export function ActiveGameRows({
  lobbyId,
  board,
  disabled,
}: ActiveGameRowsProps) {
  const moves = new Map<number, number>(
    board.data
      .entries()
      .filter((entry): entry is [number, Mark] => entry[1] !== undefined)
      .map(([pos, mark]) => [pos, mark === "X" ? 0 : 1] as const)
  );
  return (
    <>
      {ROW_LABELS.map((label, i) => (
        <ActiveGameRow
          lobbyId={lobbyId}
          start={i * 3}
          moves={moves}
          ariaLabel={label}
          disabled={disabled}
        />
      ))}
    </>
  );
}

function ActiveGameBoard({ lobby: { id: lobbyId } }: { lobby: SelectLobby }) {
  const movesArray = selectGameMoves.all({ lobbyId });
  const moves = new Map<number, number>(
    movesArray.map(({ position, ordering }) => [position, ordering])
  );
  return (
    <table class="game-board">
      <tbody hx-swap="innerHTML" sse-swap="board">
        {ROW_LABELS.map((label, i) => (
          <ActiveGameRow
            lobbyId={lobbyId}
            start={i * 3}
            moves={moves}
            ariaLabel={label}
          />
        ))}
      </tbody>
    </table>
  );
}

function ActiveGameMain({ lobby }: { lobby: SelectLobby }) {
  const lobbyId = lobby.id;
  return (
    <main
      hx-trigger="load"
      hx-ext="sse"
      sse-connect={`/api/game-move?id=${lobbyId}`}
    >
      <h3 id="lobby-winner">
        Winner: <span sse-swap="winner" />
      </h3>

      <ActiveGameBoard lobby={lobby} />
    </main>
  );
}

type DormantGameButtonProps = { children?: Mark; ariaLabel: string };

function DormantGameButton({
  children: mark,
  ariaLabel,
}: DormantGameButtonProps) {
  return (
    <button type="button" disabled aria-label={ariaLabel}>
      {mark}
    </button>
  );
}

type DormantGameRowProps = {
  start: number;
  moves: Map<number, number>;
  ariaLabel: string;
};

function DormantGameRow({
  start,
  moves,
  ariaLabel: rowLabel,
}: DormantGameRowProps) {
  return (
    <tr>
      {COLUMN_LABELS.map((colLabel, i) => {
        const ordering = moves.get(i + start);
        const mark =
          ordering !== undefined ? orderingToMark(ordering) : undefined;
        return (
          <td>
            <DormantGameButton ariaLabel={`${rowLabel}-${colLabel}`}>
              {mark}
            </DormantGameButton>
          </td>
        );
      })}
    </tr>
  );
}

function DormantGameBoard({ lobby }: { lobby: SelectLobby }) {
  const movesArray = selectGameMoves.all({ lobbyId: lobby.id });
  const moves = new Map<number, number>(
    movesArray.map(({ position, ordering }) => [position, ordering])
  );

  return (
    <table class="game-board">
      <tbody>
        {ROW_LABELS.map((label, i) => {
          return (
            <DormantGameRow start={i * 3} moves={moves} ariaLabel={label} />
          );
        })}
      </tbody>
    </table>
  );
}

function DormantGameMain({ lobby }: { lobby: SelectLobby }) {
  const lobbyId = lobby.id;
  const finishedLobby = selectFinishedLobby.get({ lobbyId });
  const winnerId = finishedLobby?.winner;

  let winnerName: string | undefined = undefined;
  if (winnerId === null) {
    winnerName = "no one";
  } else if (winnerId !== undefined) {
    const winner = selectUsername.get({ userId: winnerId });
    winnerName = winner?.username;
  }
  return (
    <main>
      <h3 id="lobby-winner">Winner: {winnerName}</h3>

      <DormantGameBoard lobby={lobby} />
    </main>
  );
}

export function GameMain({ lobby }: { lobby: SelectLobby }) {
  switch (lobby.status) {
    case "active":
      return <ActiveGameMain lobby={lobby} />;
    default:
      return <DormantGameMain lobby={lobby} />;
  }
}

export function PlayerInfo({ user }: { user?: SelectUser }) {
  if (user) {
    return <aside>{user.username}</aside>;
  } else {
    return <aside />;
  }
}

type GameHtmlProps = { lobbyId: number; user: SelectUser };

export function GameBody({ lobbyId, user }: GameHtmlProps) {
  const lobby = selectLobby.get({ lobbyId });
  if (!lobby) return null;

  let opponent: SelectUser | undefined = undefined;
  if (lobby.status !== "waiting") {
    const { playerX, playerO } = selectPlayersInGame.get({ lobbyId })!;
    const opponentId = user.id === playerX ? playerO : playerX;
    opponent = selectUser.get({ userId: opponentId });
  }

  return (
    <body>
      <DebugPanel />
      <h1>tic-tac-toe-site</h1>
      <h3 id="lobby-status">Status: {lobby.status}</h3>
      <PlayerInfo user={user} />
      <GameMain lobby={lobby} />
      <PlayerInfo user={opponent} />
    </body>
  );
}

export function GameHtml(props: GameHtmlProps) {
  return (
    <html>
      <GameHead />
      <GameBody {...props} />
    </html>
  );
}

export default GameHtml;
