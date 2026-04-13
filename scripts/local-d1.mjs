import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const repoStateDir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";

export function localD1Path() {
  return process.env.LOCAL_D1_PATH ?? findLocalD1Database(repoStateDir);
}

export function queryRows(dbPath, sql) {
  const output = execFileSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

  return output ? JSON.parse(output) : [];
}

export function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function findLocalD1Database(dir) {
  if (!existsSync(dir)) {
    throw new Error(`Local D1 directory does not exist: ${dir}`);
  }

  const sqliteFiles = readdirSync(dir)
    .filter((file) => file.endsWith(".sqlite") && file !== "metadata.sqlite")
    .map((file) => join(dir, file));

  if (sqliteFiles.length !== 1) {
    throw new Error(
      `Expected one local D1 SQLite database in ${dir}, found ${sqliteFiles.length}: ${sqliteFiles.join(", ")}`,
    );
  }

  return sqliteFiles[0];
}
