import fs from "fs";
import path from "path";
import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath });
}

if (fs.existsSync(envPath)) {
  loadEnv({ path: envPath, override: false });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({
  connectionString,
  ssl:
    process.env.PGSSL === "disable"
      ? false
      : {
          rejectUnauthorized: false,
        },
});

export async function query(text, params = []) {
  return pool.query(text, params);
}
