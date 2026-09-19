import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";

export async function retryCompetitionSmokeLogin(request, { wait = sleep, now = Date.now, onRetry = () => {} } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await request();
    if (response.status !== 429 || attempt === 2) return response;
    // Better Auth emits X-Retry-After; also accept the standard header.
    const value = (response.headers.get("retry-after") ?? response.headers.get("x-retry-after"))?.trim();
    const seconds = value && /^\d+$/.test(value) ? Number(value) : NaN;
    const date = value && /GMT$/i.test(value) ? Date.parse(value) : NaN;
    const delay = Number.isFinite(seconds) ? seconds * 1000
      : Number.isFinite(date) ? Math.max(0, date - now()) : 10_000;
    await response.arrayBuffer();
    assert.ok(delay <= 30_000, "smoke login Retry-After exceeds the 30-second retry budget");
    const waitMs = delay + 250;
    onRetry(waitMs, attempt + 1);
    await wait(waitMs);
  }
}
