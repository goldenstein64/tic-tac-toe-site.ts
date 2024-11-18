import { Html } from "@elysiajs/html";

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
      <button hx-on:click="location.href='/login/discord'" class="btn">
        Sign into Discord
      </button>
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
