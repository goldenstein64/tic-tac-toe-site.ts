/**
 * @typedef {Object} HTMXAfterRequest
 * @property {HTMLElement} elt - the element that dispatched the request
 * @property {XMLHttpRequest} xhr
 * @property {HTMLElement} target - the target of the request
 * @property {Object} requestConfig - the configuration of the AJAX request
 * @property {boolean} successful - true if the response has a 20x status code or is marked `detail.isError = false` in the `htmx:beforeSwap` event, else false
 * @property {boolean} failed - true if the response does not have a 20x status code or is marked `detail.isError = true` in the `htmx:beforeSwap` event, else false
 *
 * @typedef {CustomEvent<HTMXAfterRequest>} AfterRequestEvent
 *
 * @typedef {Object} HTMXBeforeRequest
 * @property {HTMLElement} elt - the element that dispatched the request
 * @property {XMLHttpRequest} xhr
 * @property {HTMLElement} target - the target of the request
 * @property {Object} requestConfig - the configuration of the AJAX request
 *
 * @typedef {CustomEvent<HTMXBeforeRequest>} BeforeRequestEvent
 *
 * @typedef {Object} APIUsernameResponseSuccess
 * @property {true} success
 * @property {string} username
 *
 * @typedef {Object} APIUsernameResponseFailure
 * @property {false} success
 *
 * @typedef {APIUsernameResponseSuccess | APIUsernameResponseFailure} APIUsernameResponse
 */

const ALPHANUM = /^\w+$/;
const parser = new DOMParser();

/** @type {HTMLInputElement} */
const usernameInput = htmx.find("#username-input");

/** @type {HTMLDialogElement} */
const usernameModal = htmx.find("#username-modal");

/** @type {HTMLButtonElement} */
const usernameSubmit = htmx.find("#username-submit");

{
  const usernameResponse = await fetch("/api/username");
  /** @type {APIUsernameResponse} */
  const hasUsername = usernameResponse.json();

  // If no username is stored, show the modal
  if (!hasUsername.success) {
    usernameModal.showModal();
  }
}

/**
 * @param {string} username
 * @returns {boolean}
 */
function isUsernameValid(username) {
  return (
    username.length >= 1 && username.length <= 32 && ALPHANUM.test(username)
  );
}

htmx.on("#username-input", "change", () => {
  usernameSubmit.disabled = !isUsernameValid(usernameInput.value);
});

htmx.on(
  "#username-modal",
  "htmx:before-request",
  (/** @type {BeforeRequestEvent} */ evt) => {
    /** @type {FormData} */
    const parameters = evt.detail.requestConfig.parameters;

    const username = parameters.get("username");
    if (username.length < 1) {
      alert("username must have at least 1 character");
    } else if (!ALPHANUM.test(username)) {
      alert("username must be entirely alphanumeric");
    } else if (username.length > 32) {
      alert("username must have at most 32 characters");
    } else {
      return;
    }

    evt.preventDefault();
  }
);

htmx.on(
  "#username-modal",
  "htmx:after-request",
  (/** @type {AfterRequestEvent} */ { detail: { xhr } }) => {
    const responseJSON = JSON.parse(xhr.responseText);
    if (responseJSON.success) {
      usernameModal.close();
    } else {
      alert(responseJSON.message);
    }
  }
);
