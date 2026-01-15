import { Html } from "@elysiajs/html";

import { DebugPanel } from "./debug";
import { SITE_TITLE } from "../constants";
import { TopNav, DefaultHtml } from "./base";

function LoginHead() {
  return (
    <head>
      <title>{SITE_TITLE} - Login</title>
      <script src="/public/client/login.js" type="module" />
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
      <header>
        <DebugPanel />
        <TopNav />
      </header>
      <main>
        <section>
          <button
            id="discord-sign-in"
            type="button"
            hx-on-click="location.href='/login/discord'"
          >
            Sign in with Discord
            <img
              src="/public/discord-mark-white.png"
              width="619"
              height="469"
            />
          </button>
        </section>
      </main>
    </body>
  );
}

export default function LoginHtml() {
  return (
    <DefaultHtml>
      <LoginHead />
      <LoginBody />
    </DefaultHtml>
  );
}
