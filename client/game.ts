import "htmx.org";
import "htmx-ext-sse";

const lobbyStatus = document.getElementById("lobby-status") as HTMLSpanElement;
const gameBoard = document.querySelector("section.game-board") as HTMLElement;

if (
  lobbyStatus.dataset["status"] === "active" &&
  lobbyStatus.dataset["asleep"] === undefined
) {
  gameBoard.addEventListener("htmx:sseMessage", (e: Event) => {
    const { type, data }: MessageEvent<string> = (e as any).detail;
    if (type === "status") {
      // textContent is already covered by HTMX, I just want data-status to
      // change too
      lobbyStatus.dataset["status"] = data;
    } else if (type === "end" && data === "asleep") {
      location.reload();
    }
  });
}
