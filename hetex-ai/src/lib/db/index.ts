import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const globalForDb = global as unknown as {
  libsqlClient?: ReturnType<typeof createClient>;
};

const url = process.env.DATABASE_URL ?? "file:./dev.db";

const client = globalForDb.libsqlClient ?? createClient({ url });

if (process.env.NODE_ENV !== "production") globalForDb.libsqlClient = client;

export const db = drizzle(client, { schema });
export { schema };
