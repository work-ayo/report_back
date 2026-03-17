import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();
import fs from "node:fs";
import path from "node:path";

// const isProd = process.env.NODE_ENV === "production";
// const envFile = isProd ? ".env" : ".env.dev";
// const envPath = path.join(process.cwd(), envFile);

// if (fs.existsSync(envPath)) {
//   dotenv.config({ path: envPath, override: true });
// }


const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("6h"),
  ADMIN_DEFAULT_PASSWORD: z.string().min(8),
  NODE_ENV: z.string().min(1),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("1h"),
COOKIE_SECRET: z.string().min(16),
});

export const env = EnvSchema.parse(process.env);
