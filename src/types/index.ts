import { t, Static } from "elysia";

export const TLobbyType = t.Union([
  t.Literal("waiting"),
  t.Literal("available"),
  t.Literal("active"),
  t.Literal("finished"),
]);

export type LobbyType = Static<typeof TLobbyType>;
