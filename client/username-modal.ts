import { treaty } from "@elysiajs/eden";
import type { App } from "../src";

type AfterRequestEvent = CustomEvent<{
  elt: HTMLElement;
  xhr: XMLHttpRequest;
  target: HTMLElement;
  requestConfig: any;
  successful: boolean;
  failed: boolean;
}>;

type BeforeRequestEvent = CustomEvent<{
  elt: HTMLElement;
  xhr: XMLHttpRequest;
  target: HTMLElement;
  requestConfig: any;
}>;

type APIPutUsernameResponse = NonNullable<
  Awaited<ReturnType<typeof client.api.username.put>>["data"]
>;

const client = treaty<App>("localhost:3000");

const ALPHANUM = /^\w+$/;

const usernameConfigInput = document.querySelector(
  "#user-config input[name='username']"
) as HTMLInputElement;
const usernameInput = document.querySelector(
  "#username-modal input[name='username']"
) as HTMLInputElement;
const usernameModal = document.querySelector(
  "#username-modal"
) as HTMLDialogElement;
const usernameSubmit = document.querySelector(
  "#username-modal button[type='submit']"
) as HTMLButtonElement;

{
  const { data, error } = await client.api.username.get();
  if (!error) {
    if (data.success) {
      usernameConfigInput.value = data.username;
    } else {
      usernameModal.showModal();
    }
  }
}

function isUsernameValid(username: string): boolean {
  return (
    username.length >= 1 && username.length <= 32 && ALPHANUM.test(username)
  );
}

usernameInput.addEventListener("change", () => {
  usernameSubmit.disabled = !isUsernameValid(usernameInput.value);
});

usernameModal.addEventListener("htmx:before-request", (rawEvt) => {
  const evt = rawEvt as unknown as BeforeRequestEvent;
  const parameters: FormData = evt.detail.requestConfig.parameters;

  const username = parameters.get("username")!.valueOf();
  if (typeof username !== "string") {
    alert("username must be present");
  } else if (username.length < 1) {
    alert("username must have at least 1 character");
  } else if (!ALPHANUM.test(username)) {
    alert("username must be entirely alphanumeric");
  } else if (username.length > 32) {
    alert("username must have at most 32 characters");
  } else {
    return;
  }

  evt.preventDefault();
});

usernameModal.addEventListener("htmx:after-request", (rawEvt) => {
  const evt = rawEvt as unknown as AfterRequestEvent;
  const xhr = evt.detail.xhr;
  if (xhr.status < 200 || xhr.status >= 300) return;

  const response: APIPutUsernameResponse = JSON.parse(xhr.response);
  if (response.success) {
    usernameConfigInput.value = usernameInput.value;
    usernameModal.close();
  } else {
    alert(response.message);
  }
});

export {};
