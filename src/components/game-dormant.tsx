/** components for inactive games */

import type { Mark } from "@goldenstein64/tic-tac-toe";

import { Html } from "@elysiajs/html";

import { SelectLobby } from "../db/schema";
import { selectMovesInGame } from "../db/queries";
import { orderingToMark } from "../game/run-game";
import { COLUMN_LABELS, ROW_LABELS } from "./game-active";

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
    <>
      {COLUMN_LABELS.map((colLabel, i) => {
        const ordering = moves.get(i + start);
        const mark =
          ordering !== undefined ? orderingToMark(ordering) : undefined;
        return (
          <GameButton ariaLabel={`${rowLabel}-${colLabel}`}>{mark}</GameButton>
        );
      })}
    </>
  );
}

export function GameBoard({ lobby }: { lobby: SelectLobby }) {
  const movesArray = selectMovesInGame.all({ lobbyId: lobby.id });
  const moves = new Map<number, number>(
    movesArray.map(({ position, ordering }) => [position, ordering])
  );

  return (
    <section class="game-board">
      {ROW_LABELS.map((label, i) => {
        return <GameRow start={i * 3} moves={moves} ariaLabel={label} />;
      })}
    </section>
  );
}
