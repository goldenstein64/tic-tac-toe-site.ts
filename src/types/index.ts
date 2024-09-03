import { t } from "elysia";

export const intString = t
  .Transform(t.String())
  .Decode(parseInt)
  .Encode((v) => v.toString());
