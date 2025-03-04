import type { Board, Mark } from "@goldenstein64/tic-tac-toe";

import { Html } from "@elysiajs/html";
import { eq, max, sql } from "drizzle-orm";

import { db, typePrepared } from "../db";
import { SelectLobby, Move, SelectUser } from "../db/schema";
import { orderingToMark } from "../libs/run-game";
import { DebugPanel } from "./debug";
import {
  GameHead,
  PlayerInfo,
  selectPlayersInGame,
  selectUserById,
} from "./game-base";

export const COLUMN_LABELS = ["left", "center", "right"] as const;
export const ROW_LABELS = ["Top", "Middle", "Bottom"] as const;

const _placeholders: any = undefined;

const selectGameMoves = typePrepared(
  db
    .select({ position: Move.position, ordering: Move.ordering })
    .from(Move)
    .where(eq(Move.lobbyId, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number }
);

const selectMaxOrdering = typePrepared(
  db
    .select({ maxOrdering: max(Move.ordering) })
    .from(Move)
    .where(eq(Move.lobbyId, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number }
);

type GameButtonProps = {
  disabled?: boolean;
  lobbyId: number;
  position: number;
  ariaLabel: string;
  children?: Mark;
};

function GameButton({
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
      class={[mark === "X" && "mark-x", mark === "O" && "mark-o"]}
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

function GameRow({
  lobbyId,
  start,
  moves,
  ariaLabel: rowLabel,
  disabled,
}: GameRowProps) {
  const buttons = COLUMN_LABELS.map((colLabel, i) => {
    const ordering = moves.get(i + start);
    const mark = ordering !== undefined ? orderingToMark(ordering) : undefined;
    return (
      <td>
        <GameButton
          lobbyId={lobbyId}
          position={i + start}
          ariaLabel={`${rowLabel}-${colLabel}`}
          disabled={disabled}
        >
          {mark}
        </GameButton>
      </td>
    );
  });
  return <tr>{buttons}</tr>;
}

function GameBoard({
  lobby: { id: lobbyId },
  disabled,
}: {
  lobby: SelectLobby;
  disabled?: boolean;
}) {
  const movesArray = selectGameMoves.all({ lobbyId });
  const moves = new Map<number, number>(
    movesArray.map(({ position, ordering }) => [position, ordering])
  );
  return (
    <table class="game-board">
      <tbody hx-swap="innerHTML" sse-swap="board">
        {ROW_LABELS.map((label, i) => (
          <GameRow
            lobbyId={lobbyId}
            start={i * 3}
            moves={moves}
            ariaLabel={label}
            disabled={disabled}
          />
        ))}
      </tbody>
    </table>
  );
}

type GameRowsProps = {
  lobbyId: number;
  board: Board;
  disabled?: boolean;
};

export function GameRows({ lobbyId, board, disabled }: GameRowsProps) {
  const moves = new Map<number, number>(
    board.data
      .entries()
      .filter((entry): entry is [number, Mark] => entry[1] !== undefined)
      .map(([pos, mark]) => [pos, mark === "X" ? 0 : 1] as const)
  );
  return (
    <>
      {ROW_LABELS.map((label, i) => (
        <GameRow
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

type GameBodyProps = { lobby: SelectLobby; user: SelectUser };

function GameBody({ lobby, user }: GameBodyProps) {
  const { playerX, playerO } = selectPlayersInGame.get({ lobbyId: lobby.id })!;
  const userMark = user.id === playerX ? "X" : "O";
  const opponentMark = user.id === playerX ? "O" : "X";
  const opponentId = user.id === playerX ? playerO : playerX;
  const opponent = selectUserById.get({ userId: opponentId });

  const maxResult = selectMaxOrdering.get({ lobbyId: lobby.id })!;
  const maxOrdering: number = maxResult.maxOrdering ?? 0;
  const nextMark = orderingToMark(maxOrdering + 1);

  return (
    <body
      hx-trigger="load"
      hx-ext="sse"
      sse-connect={`/api/game-move?id=${lobby.id}`}
    >
      <header>
        <DebugPanel />
        <h1>tic-tac-toe-site</h1>
        <h3 id="lobby-status">
          Status: <span sse-swap="status" />
        </h3>
        <h3 id="lobby-winner">
          Winner: <span sse-swap="winner" />
        </h3>
      </header>
      <main>
        <PlayerInfo user={user} mark={userMark} />
        <PlayerInfo user={opponent} mark={opponentMark} />
        <GameBoard lobby={lobby} disabled={nextMark !== userMark} />
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
