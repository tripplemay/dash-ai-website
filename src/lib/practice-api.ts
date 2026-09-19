// 练习 API 共享助手：会话、CSRF（same-origin）、错误映射。模式与 api/v1/learning-events 对齐。

import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_DISABLED } from "@/lib/auth";
import { PracticeError } from "@/lib/practice";
import { getSessionFromHeaders } from "@/lib/request-session";

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export function passesSameOrigin(request: NextRequest) {
  if (AUTH_DISABLED) return true;
  const expected = process.env.DASH_PUBLIC_ORIGIN?.trim() || request.nextUrl.origin;
  const supplied = request.headers.get("origin") || request.headers.get("referer");
  if (!expected || !supplied) return false;
  try {
    return new URL(supplied).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

export async function readSession(request: NextRequest) {
  try {
    return await getSessionFromHeaders(request.headers);
  } catch {
    return null;
  }
}

function statusFor(code: string) {
  switch (code) {
    case "ALREADY_ANSWERED":
      return 409;
    case "SESSION_NOT_FOUND":
    case "ANSWER_NOT_FOUND":
      return 404;
    case "SESSION_FINISHED":
    case "USER_MISMATCH":
      return 409;
    case "INVALID_IDEMPOTENCY_KEY":
    case "INVALID_BODY":
    default:
      return 400;
  }
}

export function responseForError(error: unknown) {
  if (error instanceof PracticeError) {
    return json({ error: error.code }, statusFor(error.code));
  }
  return json({ error: "DATABASE_UNAVAILABLE" }, 503);
}
