// 使用 SQLite online backup API 生成一致性副本，不直接复制 WAL/SHM。
// 用法：DASH_AUTH_DB=/opt/dash-pr/dash-auth.db DASH_BACKUP_DIR=/opt/dash-pr/backups node scripts/backup-db.mjs
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const source = path.resolve(process.env.DASH_AUTH_DB || path.join(process.cwd(), "dash-auth.db"));
const backupDir = path.resolve(process.env.DASH_BACKUP_DIR || path.join(process.cwd(), "backups"));
const requestedName = process.env.DASH_BACKUP_NAME || `dash-auth-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
const filename = path.basename(requestedName);
if (filename !== requestedName || !filename.endsWith(".db")) {
  throw new Error("DASH_BACKUP_NAME must be a single .db filename");
}
if (!fs.existsSync(source)) throw new Error(`source database not found: ${source}`);

fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
fs.chmodSync(backupDir, 0o700);
const destination = path.resolve(backupDir, filename);
const relative = path.relative(backupDir, destination);
if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("backup destination is outside backup directory");
if (destination === source) throw new Error("backup destination must differ from source database");

const db = new Database(source, { readonly: true, fileMustExist: true });
const temporary = path.join(
  backupDir,
  `.${filename}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`
);
try {
  await db.backup(temporary);
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, destination);
} finally {
  db.close();
  if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
}
fs.chmodSync(destination, 0o600);
console.log(`backup created: ${destination} (${fs.statSync(destination).size} bytes)`);
