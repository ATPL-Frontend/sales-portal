import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Local workspace: <repo>/.env. Deployed cPanel app: <app root>/api/.env.
// Prefer the app's own .env; never override genuine environment variables
// configured by cPanel/Passenger.
const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
dotenv.config({ path: path.join(appRoot, ".env"), quiet: true });
dotenv.config({ path: path.resolve(appRoot, "../.env"), quiet: true });

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  DB_HOST: z.string().default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  SEED_ADMIN_EMAIL: z.string().email().default("atplgraphics@gmail.com"),
  SEED_ADMIN_PASSWORD: z.string().min(8).default("12345678"),
});
export const env = schema.parse(process.env);
