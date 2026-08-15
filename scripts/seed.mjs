// DASH AI 营销资源站 · 账号种子脚本
// 用法：BETTER_AUTH_SECRET=... SEED_INITIAL_PASSWORD=... node scripts/seed.mjs
// DB 路径由 DASH_AUTH_DB 指定，默认 ./dash-auth.db
// 三个初始账号（partner / teacher / guest）共用 SEED_INITIAL_PASSWORD 作为初始密码，
// 生产环境务必使用强随机值；脚本可重复执行，已存在的账号会跳过（不会重置密码）。
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import Database from "better-sqlite3";
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

const auth = betterAuth({
  appName: "DASH AI Marketing Hub",
  database: new Database(dbPath),
  emailAndPassword: { enabled: true },
  plugins: [username()],
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

const ACCOUNTS = [
  { username: "partner", name: "合作伙伴", email: "partner@dash.local", password: initialPassword },
  { username: "teacher", name: "教师", email: "teacher@dash.local", password: initialPassword },
  { username: "guest", name: "访客家长", email: "guest@dash.local", password: initialPassword },
];

for (const a of ACCOUNTS) {
  try {
    await auth.api.signUpEmail({ body: { ...a }, headers: new Headers() });
    console.log("created:", a.username);
  } catch (e) {
    console.log("skip:", a.username, "-", e?.message || e);
  }
}
console.log("seed finished");
