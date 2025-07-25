import { Html } from "@elysiajs/html";
import { SelectLobby } from "../db/schema";
import { selectUserById } from "../db/queries";

import { DebugPanel } from "./debug";
import { GameHead, PlayerInfo } from "./game-base";
import { GameBoard } from "./game-dormant";

type GameBodyProps = { lobby: SelectLobby };

function GameBody({ lobby }: GameBodyProps) {
  return (
    <body>
      <header>
        <DebugPanel />
        <h1>tic-tac-toe-site</h1>
        <h3 id="lobby-status">
          Status:{" "}
          <div hx-get="/api/lobby/status" hx-trigger="every 30s">
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

export function WaitingGameHtml(props: GameBodyProps) {
  return (
    <html>
      <GameHead />
      <GameBody {...props} />
    </html>
  );
}

export default WaitingGameHtml;
