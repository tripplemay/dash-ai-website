// 清理历史重复 resources.file_key。该操作只删除重复元数据，不删除磁盘文件。
// 必须显式确认：DASH_DEDUPE_CONFIRM=YES node scripts/dedupe-resources.mjs
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { runMigrations } from "./migrate.mjs";

const dbPath = path.resolve(process.env.DASH_AUTH_DB || path.join(process.cwd(), "dash-auth.db"));
if (process.env.DASH_DEDUPE_CONFIRM !== "YES") {
  throw new Error("Refusing to delete duplicate rows; set DASH_DEDUPE_CONFIRM=YES to continue");
}

const db = new Database(dbPath, { timeout: 5000, fileMustExist: true });
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  try {
    fs.chmodSync(`${dbPath}${suffix}`, 0o600);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
try {
  const duplicateKeys = db
    .prepare("SELECT file_key FROM resources GROUP BY file_key HAVING COUNT(*) > 1 ORDER BY file_key")
    .all();
  if (duplicateKeys.length === 0) {
    runMigrations(db);
    console.log("no duplicate resource keys found");
  } else {
    const audit = [];
    const tx = db.transaction(() => {
      const rows = db.prepare(
        "SELECT id, updated_at FROM resources WHERE file_key = ? ORDER BY updated_at DESC, id DESC"
      );
      const remove = db.prepare("DELETE FROM resources WHERE id = ?");
      for (const { file_key } of duplicateKeys) {
        const matches = rows.all(file_key);
        const [keep, ...drop] = matches;
        for (const row of drop) remove.run(row.id);
        audit.push({ file_key, kept: keep.id, removed: drop.map((row) => row.id) });
      }
    });
    tx();
    runMigrations(db);
    console.log(JSON.stringify({ deduplicated: audit }, null, 2));
  }
} finally {
  db.close();
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    try {
      fs.chmodSync(`${dbPath}${suffix}`, 0o600);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}
