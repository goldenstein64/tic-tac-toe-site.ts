import { Children } from "@kitajs/html";
import { Html } from "@elysiajs/html";
import { SelectUser } from "../db/schema";

export async function UserConfig({ user }: { user: SelectUser }) {
  return (
    <section id="user-config">
      <span>{user.username} </span>
      <button
        type="button"
        hx-delete="/api/session"
        hx-swap="none"
        hx-on--after-request="location.href='/login'"
      >
        Log out
      </button>
    </section>
  );
}

export function TopNav({ children }: { children?: Children }) {
  return (
    <nav id="top-nav">
      <h1>
        <a href="/">tic-tac-toe-site</a>
      </h1>
      {children}
    </nav>
  );
}
