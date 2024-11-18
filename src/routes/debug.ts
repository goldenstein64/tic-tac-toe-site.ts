import swagger from "@elysiajs/swagger";
import Elysia from "elysia";

export default () =>
  Bun.env.NODE_ENV !== "development"
    ? new Elysia({ prefix: "/debug", name: "Debug" })
    : new Elysia({ prefix: "/debug", name: "Debug" }).use(
        swagger({ path: "/debug/swagger" })
      );
