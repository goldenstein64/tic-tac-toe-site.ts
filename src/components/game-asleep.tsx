import { Html } from "@elysiajs/html";

import {
  selectMaxOrdering,
  selectPlayersInGame,
  selectUserById,
} from "../db/queries";
import { SelectLobby, SelectUser } from "../db/schema";
import { orderingToMark } from "../game/run-game";

import { DebugPanel } from "./debug";
import { GameHead, PlayerInfo } from "./game-base";
import { TopNav, UserConfig } from "./base";
import { GameBoard } from "./game-active";

const POLL_ASLEEP = {
  "hx-get": "/api/lobby/is-asleep",
  "hx-trigger": "every 30s",
  "hx-headers": JSON.stringify({ "X-Trigger-Refresh": "true" }),
  "hx-swap": "none",
} as const;

type GameBodyProps = { lobby: SelectLobby; user: SelectUser };

async function GameBody({ lobby, user }: GameBodyProps) {
  const { playerX, playerO } = selectPlayersInGame.get({
    lobbyId: lobby.id,
  })!;

  const userMark =
    user.id === playerX ? "X"
    : user.id === playerO ? "O"
    : undefined;

  const maxResult = selectMaxOrdering.get({ lobbyId: lobby.id })!;
  const maxOrdering: number = maxResult.maxOrdering ?? -1;
  const nextMark = orderingToMark(maxOrdering + 1);

  const disabled = userMark !== nextMark;

  return (
    <body>
      <header>
        <DebugPanel />
        <TopNav>
          <div class="flex-fill" />
          <UserConfig user={user} />
        </TopNav>
        <h3 id="lobby-winner">Winner: </h3>
      </header>
      <main>
        <PlayerInfo user={selectUserById.get({ userId: playerX })} mark="X" />
        <PlayerInfo user={selectUserById.get({ userId: playerO })} mark="O" />
        <GameBoard lobby={lobby} disabled={disabled} />
      </main>
      <footer>
        <span
          id="lobby-status"
          data-status="active"
          data-asleep
          {...(disabled && POLL_ASLEEP)}
          hx-vals={disabled ? JSON.stringify({ id: lobby.id }) : undefined}
        >
          active
        </span>
      </footer>
    </body>
  );
}

export function SleepingGameHtml(props: GameBodyProps) {
  return (
    <html>
      <GameHead />
      <GameBody {...props} />
    </html>
  );
}

export default SleepingGameHtml;
