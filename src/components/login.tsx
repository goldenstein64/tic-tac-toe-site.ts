import { Html } from "@elysiajs/html";

import { DebugPanel } from "./debug";

function LoginHead() {
  return (
    <head>
      <script src="/public/htmx.min.js" />
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="/public/global.css" />
      <link rel="stylesheet" href="/public/login.css" />
    </head>
  );
}

function LoginBody() {
  return (
    <body>
      <DebugPanel />
      <section>
        <button
          id="discord-sign-in"
          type="button"
          hx-on:click="location.href='/login/discord'"
        >
          Sign in with Discord
          <img src="/public/discord-mark-white.png" width="619" height="469" />
        </button>
      </section>
    </body>
  );
}

export default function LoginHtml() {
  return (
    <html>
      <LoginHead />
      <LoginBody />
    </html>
  );
}
