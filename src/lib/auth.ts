import { betterAuth } from "better-auth";
import { username, admin } from "better-auth/plugins";
import Database from "better-sqlite3";
import path from "node:path";

const dbPath = process.env.DASH_AUTH_DB || path.join(process.cwd(), "dash-auth.db");

// 生产环境必须显式提供密钥；缺省值仅供本地开发，切勿用于线上。
// 注意：CI 构建（NODE_ENV=production）时通过占位值注入，仅用于构建期，不参与运行时签名。
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("BETTER_AUTH_SECRET is required in production");
}

export const auth = betterAuth({
  appName: "DASH AI Marketing Hub",
  database: new Database(dbPath),
  emailAndPassword: { enabled: true },
  plugins: [username(), admin()],
  secret: secret || "dash-dev-secret-local-only",
});

/** 仅本地开发可用 DASH_AUTH_DISABLED=1 跳过守卫 */
export const AUTH_DISABLED =
  process.env.DASH_AUTH_DISABLED === "1" && process.env.NODE_ENV === "development";
