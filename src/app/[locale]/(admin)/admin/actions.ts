"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { getDb } from "@/lib/db";
import { RESOURCE_CATS_STORE } from "@/lib/data";

export type ActionResult = { ok: boolean; error?: string };

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ---------- 账号 ----------

export async function createAccount(input: {
  username: string;
  name: string;
  role: string;
  password: string;
}): Promise<ActionResult> {
  try {
    await requireAdmin();
    const username = input.username.trim();
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) return { ok: false, error: "用户名需为 3–32 位字母/数字/._-" };
    if (!input.name.trim()) return { ok: false, error: "姓名不能为空" };
    if (input.password.length < 8) return { ok: false, error: "密码至少 8 位" };
    if (!["partner", "teacher", "guest", "admin"].includes(input.role))
      return { ok: false, error: "非法角色" };
    await auth.api.createUser({
      body: {
        email: `${username}@dash.local`,
        name: input.name.trim(),
        password: input.password,
        // admin 插件默认类型仅含 "admin" | "user"，运行时不限制自定义角色字符串
        role: input.role as "admin" | "user",
        data: { username },
      },
      headers: await headers(),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function resetPassword(userId: string, newPassword: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (newPassword.length < 8) return { ok: false, error: "密码至少 8 位" };
    await auth.api.setUserPassword({
      body: { userId, newPassword },
      headers: await headers(),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function setAccountBanned(userId: string, banned: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (banned) {
      await auth.api.banUser({
        body: { userId, banReason: "管理员停用" },
        headers: await headers(),
      });
    } else {
      await auth.api.unbanUser({ body: { userId }, headers: await headers() });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

// ---------- 资源 ----------

export async function updateResourceMeta(
  id: number,
  input: { title: string; category: string; print_advice: string; sort: number }
): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!input.title.trim()) return { ok: false, error: "标题不能为空" };
    if (!RESOURCE_CATS_STORE.includes(input.category)) return { ok: false, error: "非法分类" };
    getDb()
      .prepare(
        "UPDATE resources SET title = ?, category = ?, print_advice = ?, sort = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .run(input.title.trim(), input.category, input.print_advice.trim() || null, input.sort | 0, id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function setResourceEnabled(id: number, enabled: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    getDb()
      .prepare("UPDATE resources SET enabled = ?, updated_at = datetime('now') WHERE id = ?")
      .run(enabled ? 1 : 0, id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function deleteResource(id: number): Promise<ActionResult> {
  try {
    await requireAdmin();
    getDb().prepare("DELETE FROM resources WHERE id = ?").run(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
