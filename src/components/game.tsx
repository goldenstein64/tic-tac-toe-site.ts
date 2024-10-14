import type { Mark } from "@goldenstein64/tic-tac-toe/lib";

import { Html } from "@elysiajs/html";
import { eq, sql } from "drizzle-orm";

import { range } from "../util/range";
import { db } from "../db";
import { Game, Move, User } from "../db/schema";

function orderingToMark(ordering: number): Mark {
  return ordering % 2 === 1 ? "X" : "O";
}

const selectGameMoves = db
  .select({ position: Move.position, ordering: Move.ordering })
  .from(Move)
  .where(eq(Move.gameId, sql.placeholder("gameId")))
  .prepare();

const selectUser = db
  .select({ username: User.username })
  .from(User)
  .where(eq(User.id, sql.placeholder("userId")))
  .prepare();

const selectGamePlayers = db
  .select({ playerX: Game.playerX, playerO: Game.playerO })
  .from(Game)
  .where(eq(Game.id, sql.placeholder("gameId")))
  .prepare();

export function GameHead() {
  return (
    <head>
      <meta charset="UTF-8" />
      <script src="/htmx.min.js" />
      <script src="/htmx-ext-sse.js" />
      <link rel="stylesheet" href="/game.css" />
    </head>
  );
}

type GameButtonProps = {
  disabled: boolean;
  gameId: number;
  position: number;
  children?: Mark;
};

export function GameButton(props: GameButtonProps) {
  const { disabled, gameId, position, children: mark } = props;
  const hxVals = JSON.stringify({ id: gameId, position: position });
  return (
    <button
      type="button"
      sse-swap={`pos-${position}`}
      hx-swap="outerHTML"
      hx-post="/api/game-move"
      hx-vals={hxVals}
      disabled={disabled}
      style="aspect-ratio: 1"
    >
      {mark}
    </button>
  );
}

export function GameBoard(props: { gameId: number }) {
  const { gameId } = props;
  const movesArray = selectGameMoves.all({ gameId });
  const moves = new Map<number, number>(
    movesArray.map(({ position, ordering }) => [position, ordering])
  );

  return (
    <ol
      style="
        display: grid;
        grid-template-rows: 1fr 1fr 1fr;
        grid-template-columns: 1fr 1fr 1fr;
        width: 400px;
        margin-left: auto;
        margin-right: auto;
      "
    >
      {range(9).map((i) => {
        const ordering = moves.get(i + 1);
        const mark = ordering ? orderingToMark(ordering) : undefined;
        return (
          <GameButton disabled={false} gameId={gameId} position={i + 1}>
            {mark}
          </GameButton>
        );
      })}
    </ol>
  );
}

export function PlayerInfo(props: { userId: number }) {
  const { userId } = props;
  const info = selectUser.get({ userId });
  if (!info) return <aside />;
  const { username } = info;

  return <aside>{username}</aside>;
}

export function GameMain(props: { gameId: number }) {
  const { gameId } = props;
  return (
    <main
      hx-trigger="load"
      hx-ext="sse"
      sse-connect={`/api/game-move?id=${gameId}`}
    >
      <h3>
        Winner: <span sse-swap="winner" />
      </h3>

      <GameBoard gameId={gameId} />
    </main>
  );
}

type GameHtmlProps = {
  gameId: number;
  userId: number;
};

export function GameBody(props: { gameId: number; userId: number }) {
  const { gameId, userId } = props;
  const result = selectGamePlayers.get({ gameId });
  if (!result) return null;
  const { playerX, playerO } = result;
  const opponentId = userId === playerX ? playerO : playerX;
  return (
    <body>
      <h1>tic-tac-toe-site</h1>
      <PlayerInfo userId={userId} />
      <GameMain gameId={gameId} />
      <PlayerInfo userId={opponentId} />
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
