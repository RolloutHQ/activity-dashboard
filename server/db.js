import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

function asInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function sslConfig() {
  const host = process.env.DB_HOST || "";
  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(host);

  if (process.env.DB_SSL === "false") {
    return undefined;
  }

  if (!process.env.DB_SSL && isLocalHost) {
    return undefined;
  }

  return {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true",
  };
}

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: sslConfig(),
      }
    : {
        host: process.env.DB_HOST,
        port: asInt(process.env.DB_PORT, 5432),
        database: process.env.DB_NAME || process.env.DB_DATABASE,
        user: process.env.DB_USER || process.env.DB_USERNAME,
        password:
          process.env.DB_PASSWORD ||
          process.env.DB_PASS ||
          process.env.POSTGRES_PASSWORD,
        ssl: sslConfig(),
      },
);

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function closePool() {
  await pool.end();
}
