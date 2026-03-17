import path from "node:path";
import fs from "node:fs";
import pino from "pino";
import moment from "moment";
import { env } from "../config/env.js";

const logDir = path.join(process.cwd(), "logs");

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const date = moment().format("YYYY-MM-DD");
const isProd = env.NODE_ENV === "production";

const appLogPath = path.join(logDir, `${date}-app.log`);
const errorLogPath = path.join(logDir, `${date}-error.log`);

const appStream = pino.destination({
  dest: appLogPath,
  mkdir: true,
  sync: false,
});

const errorStream = pino.destination({
  dest: errorLogPath,
  mkdir: true,
  sync: false,
});

const stream = isProd
  ? pino.multistream([
      { level: "info", stream: appStream },
      { level: "error", stream: errorStream },
    ])
  : pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
        singleLine: true,
        ignore: "pid,hostname,service,env",
      },
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
      level(label) {
        return { level: label.toUpperCase() };
      },
    },
  },
  stream
);

export function registerProcessErrorLogging() {
  process.on("uncaughtException", (err) => {
    logger.error({ err }, "uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "unhandledRejection");
  });

  process.on("SIGINT", () => {
    logger.info("SIGINT received");
    appStream.flush?.();
    errorStream.flush?.();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info("SIGTERM received");
    appStream.flush?.();
    errorStream.flush?.();
    process.exit(0);
  });
}