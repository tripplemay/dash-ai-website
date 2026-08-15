// DASH AI 营销资源站 · 种子脚本（账号 + 资源元数据）
// 用法：BETTER_AUTH_SECRET=... SEED_INITIAL_PASSWORD=... SEED_ADMIN_PASSWORD=... node scripts/seed.mjs
// DB 路径由 DASH_AUTH_DB 指定，默认 ./dash-auth.db
// - admin 账号密码取 SEED_ADMIN_PASSWORD（必填，≥8 位）
// - partner / teacher / guest 三账号共用 SEED_INITIAL_PASSWORD（必填，≥8 位）
// - 脚本可重复执行：已存在的账号跳过（不重置密码），已存在的账号角色会被校正为预期值；
//   resources 表仅在为空时播种（不覆盖运营后来的改动）。
import { betterAuth } from "better-auth";
import { username, admin } from "better-auth/plugins";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dbPath = process.env.DASH_AUTH_DB || path.join(process.cwd(), "dash-auth.db");

const isProd = process.env.NODE_ENV === "production";
const secret = process.env.BETTER_AUTH_SECRET;
if (isProd && !secret) {
  console.error("FATAL: BETTER_AUTH_SECRET is required when NODE_ENV=production");
  process.exit(1);
}
const initialPassword = process.env.SEED_INITIAL_PASSWORD;
if (!initialPassword || initialPassword.length < 8) {
  console.error("FATAL: SEED_INITIAL_PASSWORD is required (min 8 chars)");
  process.exit(1);
}
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (!adminPassword || adminPassword.length < 8) {
  console.error("FATAL: SEED_ADMIN_PASSWORD is required (min 8 chars)");
  process.exit(1);
}

const auth = betterAuth({
  appName: "DASH AI Marketing Hub",
  database: new Database(dbPath),
  emailAndPassword: { enabled: true },
  plugins: [username(), admin()],
  secret: secret || "dash-dev-secret-local-only",
});

// better-auth 1.6 未从公共子路径导出 getMigrations，这里按绝对路径引入内部模块
const gmUrl = pathToFileURL(
  path.join(process.cwd(), "node_modules/better-auth/dist/db/get-migration.mjs")
).href;
const { getMigrations } = await import(gmUrl);
const { runMigrations } = await getMigrations(auth.options);
await runMigrations();
console.log("migrations done ->", dbPath);

// ---------- 账号 ----------
// role 必须与账号同名（admin / partner / teacher / guest）
const ACCOUNTS = [
  { username: "admin", name: "管理员", email: "admin@dash.local", password: adminPassword, role: "admin" },
  { username: "partner", name: "合作伙伴", email: "partner@dash.local", password: initialPassword, role: "partner" },
  { username: "teacher", name: "教师", email: "teacher@dash.local", password: initialPassword, role: "teacher" },
  { username: "guest", name: "访客家长", email: "guest@dash.local", password: initialPassword, role: "guest" },
];

// admin 插件的 createUser：无会话上下文（脚本调用）时跳过权限校验，
// role 走 body.role，username 走 data（会并入 user 记录）。
for (const a of ACCOUNTS) {
  try {
    await auth.api.createUser({
      body: {
        email: a.email,
        name: a.name,
        password: a.password,
        role: a.role,
        data: { username: a.username },
      },
    });
    console.log("created:", a.username, "(role:", a.role + ")");
  } catch (e) {
    console.log("skip:", a.username, "-", e?.message || e);
  }
}

// 校正既有账号的角色（createUser 已存在会跳过；老库里的 role 可能是 user/NULL）
const fixDb = new Database(dbPath);
const fixStmt = fixDb.prepare("UPDATE user SET role = ? WHERE username = ? AND (role IS NULL OR role != ?)");
for (const a of ACCOUNTS) {
  const r = fixStmt.run(a.role, a.username, a.role);
  if (r.changes > 0) console.log("role fixed:", a.username, "->", a.role);
}

// ---------- 资源元数据 ----------
fixDb.exec(`
CREATE TABLE IF NOT EXISTS resources (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  category     TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'file',
  format       TEXT,
  size         INTEGER,
  dimensions   TEXT,
  print_advice TEXT,
  file_key     TEXT NOT NULL,
  preview      TEXT,
  sort         INTEGER NOT NULL DEFAULT 0,
  enabled      INTEGER NOT NULL DEFAULT 1,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
)`);

const count = fixDb.prepare("SELECT COUNT(*) AS c FROM resources").get().c;
if (count > 0) {
  console.log("resources: table not empty (" + count + " rows), skip seeding");
} else {
  const seedFile = path.join(process.cwd(), "scripts", "resources-seed.json");
  const items = JSON.parse(fs.readFileSync(seedFile, "utf8"));
  const ins = fixDb.prepare(`
    INSERT INTO resources (title, category, kind, format, size, dimensions, print_advice, file_key, preview, sort)
    VALUES (@title, @category, @kind, @format, @size, @dimensions, @print_advice, @file_key, @preview, @sort)`);
  const tx = fixDb.transaction((rows) => rows.forEach((r) => ins.run(r)));
  tx(items);
  console.log("resources: seeded", items.length, "rows");
}

fixDb.close();
console.log("seed finished");
