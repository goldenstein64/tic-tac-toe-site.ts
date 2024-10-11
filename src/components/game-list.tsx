import { Html } from "@elysiajs/html";

export function GameListHead() {
  return (
    <head>
      <script src="./htmx.min.js"></script>
      <meta charset="UTF-8" />
    </head>
  );
}

export function GameItem(props: { status: string; playerCount: number }) {
  const { status, playerCount } = props;
  return (
    <tr>
      <td>{status}</td>
      <td>{playerCount}/2</td>
    </tr>
  );
}

export function GameListBody() {
  return (
    <body>
      <h1>tic-tac-toe-site</h1>
      <button type="button" hx-on:click="location.href='/create-game.html'">
        Create Game
      </button>
      <table>
        <tr>
          <th>Status</th>
          <th># of Players</th>
          <th />
        </tr>
        <span
          hx-get="/api/active-games"
          hx-trigger="load"
          hx-swap="outerHTML"
        />
      </table>
      <table>
        <tr>
          <th>Status</th>
          <th># of Players</th>
          <th />
        </tr>
        <span
          hx-get="/api/available-games"
          hx-trigger="load"
          hx-swap="outerHTML"
        />
      </table>
    </body>
  );
}

export function GameListHtml() {
  return (
    <html>
      <GameListHead />
      <GameListBody />
    </html>
  );
}
