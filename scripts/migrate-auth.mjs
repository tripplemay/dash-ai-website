// Apply Better Auth's own schema migrations to an existing database.
// This is intentionally separate from the request path and from resources
// migrations so dependency upgrades cannot silently skip auth schema changes.
import { betterAuth } from "better-auth";
import { username, admin } from "better-auth/plugins";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptRoot, "..");
const configuredDbPath = process.env.DASH_AUTH_DB || path.join(appRoot, "dash-auth.db");
const dbPath = configuredDbPath === ":memory:" ? configuredDbPath : path.resolve(configuredDbPath);

function restrictDatabaseFiles() {
  if (dbPath === ":memory:") return;
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    try {
      fs.chmodSync(`${dbPath}${suffix}`, 0o600);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

export async function runAuthMigrations(auth) {
  const migrationModule = pathToFileURL(
    path.join(appRoot, "node_modules/better-auth/dist/db/get-migration.mjs")
  ).href;
  const { getMigrations } = await import(migrationModule);
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  process.umask(0o077);
  const database = new Database(dbPath, { timeout: 30000 });
  database.pragma("busy_timeout = 30000");
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  restrictDatabaseFiles();
  const auth = betterAuth({
    appName: "芯坐标 CORECOORD",
    baseURL: "https://migration.invalid",
    database,
    emailAndPassword: { enabled: true },
    plugins: [username(), admin()],
    // Migrations do not sign requests; use a fixed non-production value so
    // deployment does not need to expose the runtime secret to this command.
    secret: "dash-auth-schema-migration-only-012345678901234567890123456789",
  });
  try {
    await runAuthMigrations(auth);
    restrictDatabaseFiles();
    console.log(`Better Auth migrations applied -> ${dbPath}`);
  } finally {
    database.close();
    restrictDatabaseFiles();
  }
}
