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

function normalizeConnectionString(input) {
  try {
    const parsed = new URL(input);

    // Keep TLS behavior controlled by PGSSL/env config, not URL params.
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("sslcert");
    parsed.searchParams.delete("sslkey");
    parsed.searchParams.delete("sslrootcert");

    return parsed.toString();
  } catch {
    return input;
  }
}

const normalizedConnectionString = normalizeConnectionString(connectionString);
const pgSslMode = (process.env.PGSSL ?? "").toLowerCase();

export const pool = new Pool({
  connectionString: normalizedConnectionString,
  ssl:
    pgSslMode === "disable"
      ? false
      : {
          rejectUnauthorized: false,
        },
});

export async function query(text, params = []) {
  return pool.query(text, params);
}
