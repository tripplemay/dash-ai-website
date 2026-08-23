// CORECOORD / 芯坐标资源站 · 种子脚本（账号 + 资源元数据）
// 用法：BETTER_AUTH_SECRET=... BETTER_AUTH_URL=... DASH_PUBLIC_ORIGIN=... \
//   SEED_INITIAL_PASSWORD=... SEED_ADMIN_PASSWORD=... node scripts/seed.mjs
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
import { runMigrations as runResourceMigrations } from "./migrate.mjs";
import { runAuthMigrations } from "./migrate-auth.mjs";

const dbPath = process.env.DASH_AUTH_DB || path.join(process.cwd(), "dash-auth.db");
process.umask(0o077);

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

const isDevelopment = process.env.NODE_ENV === "development";
const secret = process.env.BETTER_AUTH_SECRET;
if (!isDevelopment && (!secret || secret.length < 32)) {
  console.error("FATAL: BETTER_AUTH_SECRET must be at least 32 characters outside development");
  process.exit(1);
}
const baseUrl = process.env.BETTER_AUTH_URL?.trim();
if (!isDevelopment) {
  if (!baseUrl) {
    console.error("FATAL: BETTER_AUTH_URL is required outside development");
    process.exit(1);
  }
  let parsedBaseUrl;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    console.error("FATAL: BETTER_AUTH_URL must be an absolute URL");
    process.exit(1);
  }
  const localHost = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  if (parsedBaseUrl.protocol !== "https:" && !localHost.has(parsedBaseUrl.hostname)) {
    console.error("FATAL: BETTER_AUTH_URL must use HTTPS outside development");
    process.exit(1);
  }
  if (parsedBaseUrl.pathname !== "/" || parsedBaseUrl.search || parsedBaseUrl.hash) {
    console.error("FATAL: BETTER_AUTH_URL must be an origin without a path");
    process.exit(1);
  }
  const publicOrigin = process.env.DASH_PUBLIC_ORIGIN?.trim();
  if (!publicOrigin) {
    console.error("FATAL: DASH_PUBLIC_ORIGIN is required outside development");
    process.exit(1);
  }
  let parsedPublicOrigin;
  try {
    parsedPublicOrigin = new URL(publicOrigin);
  } catch {
    console.error("FATAL: DASH_PUBLIC_ORIGIN must be an absolute URL");
    process.exit(1);
  }
  if (parsedPublicOrigin.protocol !== parsedBaseUrl.protocol || parsedPublicOrigin.origin !== parsedBaseUrl.origin) {
    console.error("FATAL: DASH_PUBLIC_ORIGIN must match BETTER_AUTH_URL origin");
    process.exit(1);
  }
  if (parsedPublicOrigin.pathname !== "/" || parsedPublicOrigin.search || parsedPublicOrigin.hash) {
    console.error("FATAL: DASH_PUBLIC_ORIGIN must be an origin without a path");
    process.exit(1);
  }
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
  appName: "芯坐标 CORECOORD",
  database: (() => {
    const database = new Database(dbPath, { timeout: 30000 });
    database.pragma("busy_timeout = 30000");
    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");
    return database;
  })(),
  emailAndPassword: { enabled: true },
  plugins: [username(), admin()],
  secret: secret || "dash-dev-secret-local-only",
});
restrictDatabaseFiles();

await runAuthMigrations(auth);
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
    const message = String(e?.message || e);
    if (!/already exists|unique constraint/i.test(message)) throw e;
    console.log("skip:", a.username, "-", message);
  }
}

// 校正既有账号的角色（createUser 已存在会跳过；老库里的 role 可能是 user/NULL）
const fixDb = new Database(dbPath, { timeout: 30000 });
fixDb.pragma("busy_timeout = 30000");
fixDb.pragma("journal_mode = WAL");
fixDb.pragma("foreign_keys = ON");
restrictDatabaseFiles();
runResourceMigrations(fixDb);
const fixStmt = fixDb.prepare("UPDATE user SET role = ? WHERE username = ? AND (role IS NULL OR role != ?)");
for (const a of ACCOUNTS) {
  const r = fixStmt.run(a.role, a.username, a.role);
  if (r.changes > 0) console.log("role fixed:", a.username, "->", a.role);
}
const seededUsers = new Map(
  fixDb
    .prepare("SELECT username, role FROM user WHERE username IN (?, ?, ?, ?)")
    .all(...ACCOUNTS.map((account) => account.username))
    .map((row) => [row.username, row.role])
);
const missingAccounts = ACCOUNTS.filter(
  (account) => seededUsers.get(account.username) !== account.role
).map((account) => account.username);
if (missingAccounts.length) {
  throw new Error(`seed verification failed; missing or misconfigured accounts: ${missingAccounts.join(", ")}`);
}

// ---------- 资源元数据 ----------
const count = fixDb.prepare("SELECT COUNT(*) AS c FROM resources").get().c;
if (count > 0) {
  console.log("resources: table not empty (" + count + " rows), skip seeding");
} else {
  const seedFile = path.join(process.cwd(), "scripts", "resources-seed.json");
  const items = JSON.parse(fs.readFileSync(seedFile, "utf8"));
  const categoryKeys = {
    "品牌系统": "brand-system",
    "使用指南": "guides",
    "视觉预览": "visual-previews",
    "课件模板": "course-templates",
    "课程海报": "course-posters",
    "招募物料": "recruitment",
    "证书手册": "certificates",
    社媒: "social-media",
    "品牌资产": "brand-assets",
    吉祥物: "mascots",
  };
  const ins = fixDb.prepare(`
    INSERT INTO resources (title, category, category_key, kind, format, size, dimensions, print_advice, file_key, preview, sort)
    VALUES (@title, @category, @category_key, @kind, @format, @size, @dimensions, @print_advice, @file_key, @preview, @sort)`);
  const rows = items.map((item) => ({
    ...item,
    category_key: item.category_key || categoryKeys[item.category] || "unknown",
  }));
  const tx = fixDb.transaction((seedRows) => seedRows.forEach((r) => ins.run(r)));
  tx(rows);
  console.log("resources: seeded", items.length, "rows");
}

fixDb.close();
restrictDatabaseFiles();
console.log("seed finished");
