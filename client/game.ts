import htmx from "htmx.org";
import "htmx-ext-sse";

const body = document.body as HTMLBodyElement;
const lobbyStatus = document.getElementById("lobby-status") as HTMLSpanElement;

htmx.process(body);

if (lobbyStatus.dataset["status"] === "active") {
  // This event is dispatched just before the SSE event data is swapped into the
  // DOM. If you don't want to swap, call preventDefault() on the event.
  // Additionally, the detail field is a MessageEvent - this is the event
  // created by EventSource when it receives an SSE message.
  body.addEventListener("htmx:sseMessage", (e: Event) => {
    const { type, data }: MessageEvent<string> = (e as any).detail;
    if (type === "status") {
      // textContent is already covered by HTMX, I just want data-status to
      // change too
      lobbyStatus.dataset["status"] = data;
    }
  });
}
