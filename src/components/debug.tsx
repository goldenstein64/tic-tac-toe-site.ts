import { Html } from "@elysiajs/html";

export function DebugPanel() {
  if (Bun.env.NODE_ENV !== "development") return null;

  return (
    <div id="debug-panel">
      <h3>Debug Panel</h3>
      <form
        class="get-user"
        hx-post="/debug/user"
        hx-swap="none"
        hx-on--after-request="location.reload()"
      >
        <input type="text" name="usernameQuery" />
        <button type="submit">Get User</button>
      </form>
    </div>
  );
}
