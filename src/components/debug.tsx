import { Html } from "@elysiajs/html";

export function DebugPanel() {
  if (Bun.env.NODE_ENV !== "development") return null;

  return (
    <div style="border-width: 1px; border-style: solid; border-color: black; padding: 5px; margin: 5px">
      <h3>Debug Panel</h3>
      <form hx-post="/debug/user" hx-swap="none">
        <input type="text" name="username" />
        <button type="submit" class="btn">
          Get User
        </button>
      </form>
    </div>
  );
}
