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

const needsSSL = connectionString.includes("supabase") || connectionString.includes("sslmode=require");

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  max_lifetime: 60 * 5,
  prepare: needsSSL ? false : undefined, // Supabase transaction-mode pooler requires prepare: false
  ssl: needsSSL ? "require" : false,
  connection: {
    application_name: "lucid-api",
  },
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
