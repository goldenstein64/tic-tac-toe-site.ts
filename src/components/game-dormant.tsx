import type { Mark } from "@goldenstein64/tic-tac-toe";

import { Html } from "@elysiajs/html";

import { SelectLobby, SelectUser } from "../db/schema";
import {
  selectUserById,
  selectPlayersInGame,
  selectGameMoves,
  selectFinishedLobby,
  selectUsernameById,
} from "../db/queries";
import { orderingToMark } from "../libs/run-game";
import { DebugPanel } from "./debug";
import { COLUMN_LABELS, ROW_LABELS } from "./game-active";
import { PlayerInfo, GameHead } from "./game-base";

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

type GameBodyProps = { lobby: SelectLobby };

function WaitingGameBody({ lobby }: GameBodyProps) {
  return (
    <body>
      <header>
        <DebugPanel />
        <h1>tic-tac-toe-site</h1>
        <h3 id="lobby-status">
          Status:{" "}
          <div hx-get="/lobby/status" hx-trigger="every 30s">
            waiting
          </div>
        </h3>
        <h3 id="lobby-winner">Winner: </h3>
      </header>
      <main>
        <PlayerInfo
          user={selectUserById.get({ userId: lobby.createdBy })}
          mark={undefined}
        />
        <PlayerInfo user={undefined} mark={undefined} />
        <GameBoard lobby={lobby} />
      </main>
    </body>
  );
}

function FinishedGameBody({ lobby }: GameBodyProps) {
  const { playerX, playerO } = selectPlayersInGame.get({
    lobbyId: lobby.id,
  })!;
  const winnerId = selectFinishedLobby.get({ lobbyId: lobby.id })?.winner;
  return (
    <body>
      <header>
        <DebugPanel />
        <h1>tic-tac-toe-site</h1>
        <h3 id="lobby-status">Status: finished</h3>
        <h3 id="lobby-winner">
          Winner:{" "}
          {winnerId === null ?
            "no one" // game ended in a tie
          : winnerId === undefined ?
            undefined // game hasn't ended
          : selectUsernameById.get({ userId: winnerId })?.username}
        </h3>
      </header>
      <main>
        <PlayerInfo user={selectUserById.get({ userId: playerX })} mark="X" />
        <PlayerInfo user={selectUserById.get({ userId: playerO })} mark="O" />
        <GameBoard lobby={lobby} />
      </main>
    </body>
  );
}

function GameBody(props: GameBodyProps) {
  const { lobby } = props;
  switch (lobby.status) {
    case "waiting":
      return <WaitingGameBody {...props} />;
    case "finished":
      return <FinishedGameBody {...props} />;
    default:
      throw new TypeError(
        "attempt to show dormant lobby that is not finished and not waiting"
      );
  }
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
