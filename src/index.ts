import { app } from "./app";

app.listen({ port: 3000, idleTimeout: -1 });

export default app;
export type { App } from "./app";

console.log(
  `Running at http://${app.server?.hostname}:${app.server?.port} in ${Bun.env.NODE_ENV}`
);
