import "dotenv/config";
import buildApp from "./app.js";
import { env } from "./config/env.js";

const app = buildApp();

app.listen({ host: "0.0.0.0", port: env.PORT }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
