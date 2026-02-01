/** components for finished games */

import { Html } from "@elysiajs/html";
import { SelectLobby, SelectUser } from "../db/schema";
import {
  selectPlayersInGame,
  selectFinishedLobbyById,
  selectUsernameById,
  selectUserById,
} from "../db/queries";

import { DebugPanel } from "./debug";
import { GameHead, PlayerInfo } from "./game-base";
import { GameBoard } from "./game-dormant";
import { TopNav, UserConfig, DefaultHtml } from "./base";

type GameBodyProps = { lobby: SelectLobby; user: SelectUser };

function GameBody({ lobby, user }: GameBodyProps) {
  const { playerX, playerO } = selectPlayersInGame.get({
    lobbyId: lobby.id,
  })!;
  const winnerId = selectFinishedLobbyById.get({ lobbyId: lobby.id })?.winner;
  return (
    <body>
      <header>
        <DebugPanel />
        <TopNav>
          <div class="flex-fill" />
          <UserConfig user={user} />
        </TopNav>
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
      <footer>
        <span id="lobby-status" data-status="finished">
          finished
        </span>
      </footer>
    </body>
  );
}

export function FinishedGameHtml(props: GameBodyProps) {
  return (
    <DefaultHtml>
      <GameHead />
      <GameBody {...props} />
    </DefaultHtml>
  );
}

export default FinishedGameHtml;
