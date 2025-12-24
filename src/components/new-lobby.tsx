import { Html } from "@elysiajs/html";

import { DebugPanel } from "./debug";
import { TopNav, UserConfig } from "./base";
import { SITE_TITLE } from "../constants";
import { Mark } from "@goldenstein64/tic-tac-toe";
import { SelectUser } from "../db/schema";

function NewLobbyHead() {
  return (
    <head>
      <title>{SITE_TITLE} - New Lobby</title>
      <script src="/public/client/new-lobby.js" type="module" />
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="/public/global.css" />
      <link rel="stylesheet" href="/public/new-lobby.css" />
    </head>
  );
}

const PLAYER_TYPES = Object.freeze([
  { name: "Human", id: -1 },
  { name: "Easy Computer", id: 1 },
  { name: "Medium Computer", id: 2 },
  { name: "Hard Computer", id: 3 },
] as const);

type PlayerTypeInputProps = { mark: Mark };
function PlayerTypeInput({ mark }: PlayerTypeInputProps) {
  const lower = mark.toLowerCase();

  return (
    <>
      <span>Player {mark} Type:</span>
      {PLAYER_TYPES.map(({ name, id }) => (
        <>
          <br />
          <input
            id={`select-${lower}-${id}`}
            type="radio"
            name={`type${mark}`}
            value={String(id)}
          />
          <label for={`select-${lower}-${id}`}>{name}</label>
        </>
      ))}
    </>
  );
}

type NewLobbyProps = { user: SelectUser; csrfToken: string };

function NewLobbyBody({ user, csrfToken }: NewLobbyProps) {
  return (
    <body>
      <header>
        <DebugPanel />
        <TopNav>
          <div class="flex-fill" />
          <UserConfig user={user} />
        </TopNav>
      </header>
      <main>
        <form name="game-setup" hx-post="/api/lobby" hx-swap="none">
          <input type="hidden" name="_csrf" value={csrfToken} />
          <fieldset style={{ display: "inline-block" }}>
            <PlayerTypeInput mark="X" />
          </fieldset>
          <fieldset style={{ display: "inline-block" }}>
            <PlayerTypeInput mark="O" />
          </fieldset>
          <button type="submit" style={{ display: "block" }}>
            Create
          </button>
        </form>
      </main>
    </body>
  );
}

export function NewLobbyHtml({ user, csrfToken }: NewLobbyProps) {
  return (
    <html>
      <NewLobbyHead />
      <NewLobbyBody user={user} csrfToken={csrfToken} />
    </html>
  );
}
