import { Html } from "@elysiajs/html";

function LoginHead() {
  return <head></head>;
}

function LoginBody() {
  return (
    <body>
      <form>
        <input type="text" placeholder="username" />
        <input type="password" placeholder="password" />
      </form>
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
