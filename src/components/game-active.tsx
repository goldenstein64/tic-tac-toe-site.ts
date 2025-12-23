import type { Board, Mark } from "@goldenstein64/tic-tac-toe";

import { Html } from "@elysiajs/html";

import {
  selectMovesInGame,
  selectMaxOrdering,
  selectPlayersInGame,
  selectUserById,
} from "../db/queries";
import { SelectLobby, SelectUser } from "../db/schema";
import { orderingToMark } from "../game/run-game";
import { DebugPanel } from "./debug";
import { GameHead, PlayerInfo } from "./game-base";
import { TopNav, UserConfig } from "./base";

export const COLUMN_LABELS = ["left", "center", "right"] as const;
export const ROW_LABELS = ["Top", "Middle", "Bottom"] as const;

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
  return (
    <>
      {COLUMN_LABELS.map((colLabel, i) => {
        const ordering = moves.get(i + start);
        const mark =
          ordering !== undefined ? orderingToMark(ordering) : undefined;
        return (
          <GameButton
            lobbyId={lobbyId}
            position={i + start}
            ariaLabel={`${rowLabel}-${colLabel}`}
            disabled={disabled}
          >
            {mark}
          </GameButton>
        );
      })}
    </>
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

type GameBoardProps = { lobby: SelectLobby; disabled?: boolean };

function GameBoard({ lobby: { id: lobbyId }, disabled }: GameBoardProps) {
  const movesArray = selectMovesInGame.all({ lobbyId });
  const moves = new Map<number, number>(
    movesArray.map(({ position, ordering }) => [position, ordering])
  );
  return (
    <section class="game-board" hx-swap="innerHTML" sse-swap="board">
      {ROW_LABELS.map((label, i) => (
        <GameRow
          lobbyId={lobbyId}
          start={i * 3}
          moves={moves}
          ariaLabel={label}
          disabled={disabled}
        />
      ))}
    </section>
  );
}

type GameBodyProps = { lobby: SelectLobby; user: SelectUser };

function GameBody({ lobby, user }: GameBodyProps) {
  const { playerX, playerO } = selectPlayersInGame.get({ lobbyId: lobby.id })!;
  // TODO: the user may not be playing the game, so don't assume they are Os otherwise
  const userMark =
    user.id === playerX ? "X"
    : user.id === playerO ? "O"
    : undefined;

  const playerXUser = selectUserById.get({ userId: playerX });
  const playerOUser = selectUserById.get({ userId: playerO });

  const maxResult = selectMaxOrdering.get({ lobbyId: lobby.id })!;
  const maxOrdering: number = maxResult.maxOrdering ?? -1;
  const nextMark = orderingToMark(maxOrdering + 1);

  return (
    <body
      hx-trigger="load"
      hx-ext="sse"
      sse-connect={`/api/game-move?id=${lobby.id}`}
      sse-close="end"
    >
      <header>
        <DebugPanel />
        <TopNav>
          <div class="flex-fill" />
          <UserConfig user={user} />
        </TopNav>
        <h3 id="lobby-winner">
          Winner: <span sse-swap="winner" />
        </h3>
      </header>
      <main>
        <PlayerInfo user={playerXUser} mark="X" />
        <PlayerInfo user={playerOUser} mark="O" />
        <GameBoard lobby={lobby} disabled={nextMark !== userMark} />
      </main>
      <footer>
        <span id="lobby-status" sse-swap="status" data-status="active">
          active
        </span>
      </footer>
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
