import { Html } from "@elysiajs/html";

export function UsernameHead() {
  return (
    <>
      <link rel="stylesheet" href="/public/modal.css" />
      <script defer type="module" src="/public/out/username-modal.js" />
    </>
  );
}

export function UsernameModal() {
  return (
    <dialog id="username-modal">
      <form hx-put="/api/username" hx-swap="none">
        <h2>Enter your username</h2>
        <input
          type="text"
          id="username-input"
          name="username"
          autofocus="true"
          placeholder="Username"
        />
        <ul>
          <li>Must be between 1 and 32 characters</li>
          <li>Must be entirely alphanumeric</li>
        </ul>
        <button id="username-submit" type="submit" hx-disabled-elt="this">
          Submit
        </button>
      </form>
    </dialog>
  );
}
