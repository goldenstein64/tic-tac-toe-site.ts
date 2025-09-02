import { Children } from "@kitajs/html";
import { Html } from "@elysiajs/html";

export function TopNav({ children }: { children?: Children }) {
  return (
    <nav id="top-nav">
      <h1>tic-tac-toe-site</h1>
      {children}
    </nav>
  );
}
