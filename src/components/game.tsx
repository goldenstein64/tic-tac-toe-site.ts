import type { Mark } from "@goldenstein64/tic-tac-toe/lib";

import { Html } from "@elysiajs/html";
import { eq, sql } from "drizzle-orm";

import { range } from "../util/range";
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

function orderingToMark(ordering: number): Mark {
  return ordering % 2 === 1 ? "X" : "O";
}

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
  children?: Mark;
};

export function ActiveGameButton({
  disabled,
  lobbyId,
  position,
  children: mark,
}: GameButtonProps) {
  return (
    <button
      type="button"
      class="game-button"
      hx-post="/api/game-move"
      hx-swap="none"
      hx-vals={{ id: lobbyId, position: position }}
      disabled={disabled}
    >
      {mark}
    </button>
  );
}

function ActiveGameBoard({ lobby }: { lobby: SelectLobby }) {
  const lobbyId = lobby.id;
  const movesArray = selectGameMoves.all({ lobbyId });
  const moves = new Map<number, number>(
    movesArray.map(({ position, ordering }) => [position, ordering])
  );

  return (
    <ol class="game-board" hx-swap="innerHTML" sse-swap="board">
      {range(9).map((i) => {
        const ordering = moves.get(i);
        const mark = ordering ? orderingToMark(ordering) : undefined;
        return (
          <ActiveGameButton lobbyId={lobbyId} position={i}>
            {mark}
          </ActiveGameButton>
        );
      })}
    </ol>
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
      <h3>
        Winner: <span sse-swap="winner" />
      </h3>

      <ActiveGameBoard lobby={lobby} />
    </main>
  );
}

function DormantGameButton({ children: mark }: { children?: Mark }) {
  return (
    <button type="button" class="game-button" disabled>
      {mark}
    </button>
  );
}

function DormantGameBoard({ lobby }: { lobby: SelectLobby }) {
  const movesArray = selectGameMoves.all({ lobbyId: lobby.id });
  const moves = new Map<number, number>(
    movesArray.map(({ position, ordering }) => [position, ordering])
  );

  return (
    <ol class="game-board">
      {range(9).map((i) => {
        const ordering = moves.get(i);
        const mark = ordering ? orderingToMark(ordering) : undefined;
        return <DormantGameButton>{mark}</DormantGameButton>;
      })}
    </ol>
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
      <h3>Winner: {winnerName}</h3>

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
