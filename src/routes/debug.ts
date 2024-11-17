import swagger from "@elysiajs/swagger";
import Elysia from "elysia";

export default Bun.env.NODE_ENV !== "development"
  ? new Elysia()
  : new Elysia({ prefix: "/debug" }).use(swagger({ path: "/debug/swagger" }));
