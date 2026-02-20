import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Client } from "pg";

const splitStatements = (sql: string): string[] =>
  sql
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

async function run() {
  const schemaPath = resolve(process.cwd(), "../../db/schema.sql");
  if (!existsSync(schemaPath)) {
    throw new Error(`Schema not found: ${schemaPath}`);
  }

  const rawSql = readFileSync(schemaPath, "utf8");
  const sql = rawSql.replace(/create extension if not exists "pgcrypto";/i, "");
  const statements = splitStatements(sql);
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      for (const statement of statements) {
        await client.query(statement);
      }
      // eslint-disable-next-line no-console
      console.log(`Applied ${statements.length} statements to postgres`);
    } finally {
      await client.end();
    }
    return;
  }

  const dbPath = resolve(process.cwd(), ".local-pg");
  const pglite = new PGlite(dbPath);
  for (const statement of statements) {
    await pglite.exec(statement);
  }
  await pglite.close();
  // eslint-disable-next-line no-console
  console.log(`Applied ${statements.length} statements to pglite at ${dbPath}`);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
