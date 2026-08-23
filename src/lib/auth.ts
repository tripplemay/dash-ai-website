import { betterAuth } from "better-auth";
import { username, admin } from "better-auth/plugins";
import Database from "better-sqlite3";
import path from "node:path";

const dbPath = process.env.DASH_AUTH_DB || path.join(process.cwd(), "dash-auth.db");
const isDevelopment = process.env.NODE_ENV === "development";
const configuredBaseUrl = process.env.BETTER_AUTH_URL?.trim();
let parsedBaseUrl: URL | undefined;

if (!isDevelopment) {
  if (!configuredBaseUrl) {
    throw new Error("BETTER_AUTH_URL is required outside development");
  }
  try {
    parsedBaseUrl = new URL(configuredBaseUrl);
  } catch {
    throw new Error("BETTER_AUTH_URL must be an absolute URL");
  }
  const localHost = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  if (parsedBaseUrl.protocol !== "https:" && !localHost.has(parsedBaseUrl.hostname)) {
    throw new Error("BETTER_AUTH_URL must use HTTPS outside development");
  }
  if (parsedBaseUrl.pathname !== "/" || parsedBaseUrl.search || parsedBaseUrl.hash) {
    throw new Error("BETTER_AUTH_URL must be an origin without a path");
  }
  const configuredPublicOrigin = process.env.DASH_PUBLIC_ORIGIN?.trim();
  if (!configuredPublicOrigin) {
    throw new Error("DASH_PUBLIC_ORIGIN is required outside development");
  }
  let parsedPublicOrigin: URL;
  try {
    parsedPublicOrigin = new URL(configuredPublicOrigin);
  } catch {
    throw new Error("DASH_PUBLIC_ORIGIN must be an absolute URL");
  }
  if (parsedPublicOrigin.protocol !== parsedBaseUrl.protocol || parsedPublicOrigin.origin !== parsedBaseUrl.origin) {
    throw new Error("DASH_PUBLIC_ORIGIN must match BETTER_AUTH_URL origin");
  }
  if (parsedPublicOrigin.pathname !== "/" || parsedPublicOrigin.search || parsedPublicOrigin.hash) {
    throw new Error("DASH_PUBLIC_ORIGIN must be an origin without a path");
  }
}

function openAuthDatabase() {
  const database = new Database(dbPath, { timeout: 30000 });
  // Build workers can initialize the shared SQLite file concurrently. Set the
  // busy timeout before the WAL transition so the first writer wins cleanly.
  database.pragma("busy_timeout = 30000");
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  return database;
}

// 生产环境必须显式提供密钥；缺省值仅供本地开发，切勿用于线上。
// 注意：CI 构建（NODE_ENV=production）时通过占位值注入，仅用于构建期，不参与运行时签名。
const secret = process.env.BETTER_AUTH_SECRET;
if (!isDevelopment && (!secret || secret.length < 32)) {
  throw new Error("BETTER_AUTH_SECRET must be at least 32 characters outside development");
}
if (process.env.DASH_AUTH_DISABLED === "1" && !isDevelopment) {
  throw new Error("DASH_AUTH_DISABLED is only allowed when NODE_ENV=development");
}

export const auth = betterAuth({
  appName: "芯坐标 CORECOORD",
  database: openAuthDatabase(),
  emailAndPassword: { enabled: true },
  plugins: [username(), admin()],
  secret: secret || "dash-dev-secret-local-only",
});

/** 仅本地开发可用 DASH_AUTH_DISABLED=1 跳过守卫 */
export const AUTH_DISABLED =
  process.env.DASH_AUTH_DISABLED === "1" && isDevelopment;
