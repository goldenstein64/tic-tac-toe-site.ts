import type { Mark } from "@goldenstein64/tic-tac-toe";

import { Html } from "@elysiajs/html";

import { SelectUser } from "../db/schema";
import { SITE_TITLE } from "../constants";

export function GameHead() {
  return (
    <head>
      <title>{SITE_TITLE} - Game</title>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <script src="/public/htmx.min.js" />
      <script src="/public/htmx-ext-sse.js" />
      <link rel="stylesheet" href="/public/global.css" />
      <link rel="stylesheet" href="/public/game.css" />
    </head>
  );
}
export function PlayerInfo({ user, mark }: { user?: SelectUser; mark?: Mark }) {
  if (user) {
    return (
      <aside>
        <p>{user.username}</p>
        {mark && <p>{mark}</p>}
      </aside>
    );
  } else {
    return <aside />;
  }
}
