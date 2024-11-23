import { Elysia } from "elysia";

export default new Elysia({ prefix: "/api" }).delete(
  "/session",
  async ({ cookie: { access: cookieAccess, refresh: cookieRefresh } }) => {
    cookieAccess.remove();
    cookieRefresh.remove();
  }
);
