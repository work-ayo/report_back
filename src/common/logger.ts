import path from "node:path";
import fs from "node:fs";
import pino from "pino";
import moment from "moment";
import { env } from "../config/env.js";

const logDir = path.join(process.cwd(), "logs");

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const isProd = env.NODE_ENV === "production";

const stream = isProd
  ? pino.transport({
      targets: [
        {
          target: "pino-roll",
          level: "info",
          options: {
            file: path.join(logDir, "app.log"),
            frequency: "daily",
            dateFormat: "yyyy-MM-dd",
            mkdir: true,
          },
        },
        {
          target: "pino-roll",
          level: "error",
          options: {
            file: path.join(logDir, "error.log"),
            frequency: "daily",
            dateFormat: "yyyy-MM-dd",
            mkdir: true,
          },
        },
      ],
    })
  : pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
        singleLine: true,
        ignore: "pid,hostname,service,env",
      },
    });

stream.on("ready", () => {
  console.log("[logger] transport ready");
});

stream.on("error", (err) => {
  console.error("[logger] transport error", err);
});

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),

    base: {
      service: "inventory-back",
      env: env.NODE_ENV,
    },

    timestamp: () => {
      return `,"time":"${moment().format("YYYY-MM-DD HH:mm:ss")}"`;
    },

    formatters: {
      bindings() {
        return {};
      },
    },
  },
  stream
);

export function registerProcessErrorLogging() {
  process.on("uncaughtException", async (err) => {
    logger.error({ err }, "uncaughtException");
    await logger.flush();
  });

  process.on("unhandledRejection", async (reason) => {
    logger.error({ err: reason }, "unhandledRejection");
    await logger.flush();
  });

  process.on("SIGINT", async () => {
    logger.info("SIGINT received");
    await logger.flush();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received");
    await logger.flush();
    process.exit(0);
  });
}