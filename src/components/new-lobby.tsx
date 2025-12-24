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

type PlayerTypeInputProps = { mark: Mark };
function PlayerTypeInput({ mark }: PlayerTypeInputProps) {
  const lower = mark.toLowerCase();
  return (
    <>
      <label for={`type-${lower}`}>Player {mark} Type:</label>
      <select id={`type-${lower}`} name={`type${mark}`} required>
        <option value="-1">Human</option>
        <option value="1">Easy Computer</option>
        <option value="2">Medium Computer</option>
        <option value="3">Hard Computer</option>
      </select>
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
          <fieldset class="row">
            <PlayerTypeInput mark="X" />
          </fieldset>
          <fieldset class="row">
            <PlayerTypeInput mark="O" />
          </fieldset>
          <fieldset class="row">
            <button type="submit">Create</button>
          </fieldset>
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
