import { Html } from "@elysiajs/html";
import { SelectLobby, SelectUser } from "../db/schema";
import { selectUserById } from "../db/queries";

import { DebugPanel } from "./debug";
import { GameHead, PlayerInfo } from "./game-base";
import { GameBoard } from "./game-dormant";
import { TopNav, UserConfig } from "./base";

type GameBodyProps = { lobby: SelectLobby; user: SelectUser };

function GameBody({ lobby, user }: GameBodyProps) {
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
        <PlayerInfo
          user={selectUserById.get({ userId: lobby.createdBy })}
          mark={undefined}
        />
        <GameBoard lobby={lobby} />
      </main>
      <footer>
        <span
          hx-get={`/api/lobby/status?id=${lobby.id}`}
          hx-trigger="every 30s"
          id="lobby-status"
          data-status="waiting"
        >
          waiting
        </span>
      </footer>
    </body>
  );
}

export function WaitingGameHtml(props: GameBodyProps) {
  return (
    <>
      <html>
        <GameHead />
        <GameBody {...props} />
      </html>
    </>
  );
}

export default WaitingGameHtml;
