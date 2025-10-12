import "htmx.org";
import "htmx-ext-sse";

const lobbyStatus = document.getElementById("lobby-status") as HTMLSpanElement;

if (lobbyStatus.dataset["status"] === "active") {
  document.body.addEventListener("htmx:sseMessage", (e: Event) => {
    const { type, data }: MessageEvent<string> = (e as any).detail;
    if (type === "status") {
      // textContent is already covered by HTMX, I just want data-status to
      // change too
      lobbyStatus.dataset["status"] = data;
    }
  });
}
