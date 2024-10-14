import { Html, html } from "@elysiajs/html";
import Elysia from "elysia";

export default new Elysia({ prefix: "/api" })
  .use(html())
  .post("/lobby", () => {});
