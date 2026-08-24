// Verify that the persistent Better Auth database is initialized before a
// release is allowed to run migrations or accept traffic.
import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.resolve(process.env.DASH_AUTH_DB || path.join(process.cwd(), "dash-auth.db"));
const db = new Database(dbPath, { readonly: true, fileMustExist: true, timeout: 5000 });
try {
  const integrity = db.pragma("integrity_check", { simple: true });
  if (integrity !== "ok") throw new Error(`SQLite integrity_check failed: ${integrity}`);

  // Deployments run this check once before Better Auth migrations. In that
  // phase an older database may legitimately lack tables introduced by the
  // current Better Auth version; still require the durable user table and a
  // non-empty user set before allowing an upgrade to proceed.
  const authOnly = process.env.DASH_CHECK_DB_AUTH_ONLY === "1";
  const required = authOnly ? ["user"] : ["user", "session", "account", "verification"];
  const requireWorkspaceSchema = !authOnly && process.env.DASH_CHECK_DB_REQUIRE_RESOURCES === "1";
  if (requireWorkspaceSchema) required.push("resources", "workspace_course_activity");
  const placeholders = required.map(() => "?").join(",");
  const present = new Set(
    db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`)
      .all(...required)
      .map((row) => row.name)
  );
  const missing = required.filter((name) => !present.has(name));
  if (missing.length) throw new Error(`database is not initialized; missing tables: ${missing.join(", ")}`);

  const users = db.prepare("SELECT COUNT(*) AS count FROM user").get().count;
  if (users < 1) throw new Error("database is not initialized; no user account exists");
  if (requireWorkspaceSchema) {
    const resourceColumns = new Set(db.prepare("PRAGMA table_info(resources)").all().map((row) => row.name));
    const missingResourceColumns = ["title_en", "category_en"].filter((name) => !resourceColumns.has(name));
    if (missingResourceColumns.length) {
      throw new Error(`database is not ready; resources is missing columns: ${missingResourceColumns.join(", ")}`);
    }
  }
  console.log(`database ready: ${dbPath} (${users} users)`);
} finally {
  db.close();
}
