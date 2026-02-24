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
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false, // Required for Supabase transaction-mode pooler
  ssl: "require",
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
