// ============================================
// LUCID API — Database Connection
// ============================================

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 30,
  max_lifetime: 60 * 5,
  prepare: false, // Required for Supabase transaction-mode pooler
  ssl: "require",
  connection: {
    application_name: "lucid-api",
  },
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
