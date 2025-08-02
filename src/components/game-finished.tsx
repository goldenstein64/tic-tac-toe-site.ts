import { Html } from "@elysiajs/html";
import { SelectLobby } from "../db/schema";
import {
  selectPlayersInGame,
  selectFinishedLobby,
  selectUsernameById,
  selectUserById,
} from "../db/queries";

import { DebugPanel } from "./debug";
import { GameHead, PlayerInfo } from "./game-base";
import { GameBoard } from "./game-dormant";
import { SITE_TITLE } from "../constants";

type GameBodyProps = { lobby: SelectLobby };

function GameBody({ lobby }: GameBodyProps) {
  const { playerX, playerO } = selectPlayersInGame.get({
    lobbyId: lobby.id,
  })!;
  const winnerId = selectFinishedLobby.get({ lobbyId: lobby.id })?.winner;
  return (
    <body>
      <header>
        <DebugPanel />
        <h1>{SITE_TITLE}</h1>
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

export function FinishedGameHtml(props: GameBodyProps) {
  return (
    <html>
      <GameHead />
      <GameBody {...props} />
    </html>
  );
}

export default FinishedGameHtml;
