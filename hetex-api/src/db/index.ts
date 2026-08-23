import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../env";
import * as schema from "./schema";

// Managed Postgres (Render, Neon, Supabase, …) terminates TLS with a
// certificate chain Node doesn't ship a root for, so verification is disabled
// for remote hosts. Local development over a plain socket needs no TLS at all.
const isLocal =
  env.DATABASE_URL.includes("localhost") ||
  env.DATABASE_URL.includes("127.0.0.1");

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client:", err.message);
});

export const db = drizzle(pool, { schema });
export { schema };
