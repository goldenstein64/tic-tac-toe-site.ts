import { t, Static } from "elysia";

export const intString = t
  .Transform(t.String())
  .Decode((s) => parseInt(s))
  .Encode((v) => v.toString());

export const TLobbyType = t.Union([
  t.Literal("waiting"),
  t.Literal("available"),
  t.Literal("active"),
  t.Literal("finished"),
]);

export type LobbyType = Static<typeof TLobbyType>;
