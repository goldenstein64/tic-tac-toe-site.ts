import type { Mark } from "@goldenstein64/tic-tac-toe/lib";

import { Html } from "@elysiajs/html";
import { eq, sql } from "drizzle-orm";

import { range } from "../util/range";
import { db } from "../db";
import { Game, Move, SelectUser, User } from "../db/schema";

function orderingToMark(ordering: number): Mark {
  return ordering % 2 === 1 ? "X" : "O";
}

const selectGameMoves = db
  .select({ position: Move.position, ordering: Move.ordering })
  .from(Move)
  .where(eq(Move.lobbyId, sql.placeholder("lobbyId")))
  .prepare();

const selectUser = db
  .select()
  .from(User)
  .where(eq(User.id, sql.placeholder("userId")))
  .prepare();

const selectGamePlayers = db
  .select({ playerX: Game.playerX, playerO: Game.playerO })
  .from(Game)
  .where(eq(Game.lobbyId, sql.placeholder("lobbyId")))
  .prepare();

export function GameHead() {
  return (
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <script src="/public/htmx.min.js" />
      <script src="/public/htmx-ext-sse.js" />
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

export function GameButton(props: GameButtonProps) {
  const { disabled, lobbyId, position, children: mark } = props;
  return (
    <button
      type="button"
      class="game-button"
      sse-swap={`pos-${position}`}
      hx-vals={{ id: lobbyId, position: position }}
      disabled={disabled}
    >
      {mark}
    </button>
  );
}

export function GameBoard(props: { lobbyId: number }) {
  const { lobbyId } = props;
  const movesArray = selectGameMoves.all({ lobbyId });
  const moves = new Map<number, number>(
    movesArray.map(({ position, ordering }) => [position, ordering])
  );

  return (
    <ol class="game-board" hx-post="/api/game-move" hx-swap="outerHTML">
      {range(9).map((i) => {
        const ordering = moves.get(i + 1);
        const mark = ordering ? orderingToMark(ordering) : undefined;
        return (
          <GameButton disabled={false} lobbyId={lobbyId} position={i + 1}>
            {mark}
          </GameButton>
        );
      })}
    </ol>
  );
}

export function PlayerInfo({ user }: { user: SelectUser | undefined }) {
  if (!user) return <aside />;
  return <aside>{user.username}</aside>;
}

export function GameMain(props: { lobbyId: number }) {
  const { lobbyId } = props;
  return (
    <main
      hx-trigger="load"
      hx-ext="sse"
      sse-connect={`/api/game-move?id=${lobbyId}`}
    >
      <h3>
        Winner: <span sse-swap="winner" />
      </h3>

      <GameBoard lobbyId={lobbyId} />
    </main>
  );
}

type GameHtmlProps = {
  lobbyId: number;
  user: SelectUser;
};

export function GameBody({ lobbyId, user }: GameHtmlProps) {
  const result = selectGamePlayers.get({ lobbyId });
  if (!result) return null;
  const { playerX, playerO } = result;
  const opponentId = user.id === playerX ? playerO : playerX;
  const opponent = selectUser.get({ userId: opponentId });
  return (
    <body>
      <h1>tic-tac-toe-site</h1>
      <PlayerInfo user={user} />
      <GameMain lobbyId={lobbyId} />
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
