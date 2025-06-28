import { describe, it, expect } from "bun:test";
import { signAccess } from "#/test/util";
import { app } from "./app";

describe("/new-lobby", () => {
  const newLobby = Bun.file("private/new-lobby.html");

  it("gives me private/new-lobby.html", async () => {
    const request = new Request("http://localhost/new-lobby", {
      headers: { Cookie: `access=${await signAccess({ userId: 4 })}` },
    });
    const response = await app.handle(request);
    expect(response.status).toBe(200);
    expect(response.text()).resolves.toEqual(await newLobby.text());
  });
});
