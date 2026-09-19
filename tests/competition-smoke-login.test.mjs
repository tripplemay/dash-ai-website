import assert from "node:assert/strict";
import test from "node:test";
import { retryCompetitionSmokeLogin } from "../scripts/competition-smoke-login.mjs";

function fixture(responses, now = Date.parse("2026-09-19T00:00:00Z")) {
  const waits = [];
  const retries = [];
  let calls = 0;
  const run = () => retryCompetitionSmokeLogin(() => {
    assert.ok(calls < responses.length, "unexpected extra login request");
    return responses[calls++];
  }, { wait: async (ms) => { waits.push(ms); }, now: () => now, onRetry: (ms, attempt) => retries.push({ ms, attempt }) });
  return { run, waits, retries, calls: () => calls };
}
const limited = (headers = {}) => new Response("rate limited", { status: 429, headers });

test("smoke login success does not wait or retry", async () => {
  const ok = new Response("ok");
  const f = fixture([ok]);
  assert.equal(await f.run(), ok);
  assert.equal(f.calls(), 1);
  assert.deepEqual(f.waits, []);
});

test("smoke login honors Better Auth X-Retry-After and releases the response body", async () => {
  const throttled = limited({ "X-Retry-After": "10" });
  const f = fixture([throttled, new Response("ok")]);
  assert.equal((await f.run()).status, 200);
  assert.equal(throttled.bodyUsed, true);
  assert.deepEqual(f.waits, [10_250]);
  assert.deepEqual(f.retries, [{ ms: 10_250, attempt: 1 }]);
});

test("smoke login prefers standard Retry-After delta seconds", async () => {
  const f = fixture([limited({ "Retry-After": "2", "X-Retry-After": "10" }), new Response("ok")]);
  await f.run();
  assert.deepEqual(f.waits, [2250]);
});

test("smoke login accepts HTTP-date and elapsed retry windows", async () => {
  for (const [value, expected] of [["Sat, 19 Sep 2026 00:00:04 GMT", 4250], ["Sat, 19 Sep 2026 00:00:00 GMT", 250], ["0", 250]]) {
    const f = fixture([limited({ "Retry-After": value }), new Response("ok")]);
    await f.run();
    assert.deepEqual(f.waits, [expected]);
  }
});

test("smoke login uses the default window for absent or invalid retry hints", async () => {
  for (const value of [undefined, "", "invalid", "-1", "Infinity"]) {
    const f = fixture([limited(value === undefined ? {} : { "Retry-After": value }), new Response("ok")]);
    await f.run();
    assert.deepEqual(f.waits, [10_250]);
  }
});

test("smoke login preserves a persistent 429 after at most two retries", async () => {
  const last = limited();
  const f = fixture([limited(), limited(), last]);
  assert.equal(await f.run(), last);
  assert.equal(f.calls(), 3);
  assert.deepEqual(f.waits, [10_250, 10_250]);
});

test("smoke login fails instead of waiting beyond its retry budget", async () => {
  const f = fixture([limited({ "Retry-After": "31" })]);
  await assert.rejects(f.run, /exceeds the 30-second retry budget/);
  assert.equal(f.calls(), 1);
  assert.deepEqual(f.waits, []);
});

test("smoke login does not retry authentication or server errors", async () => {
  for (const code of [400, 401, 403, 500, 503]) {
    const response = new Response("failure", { status: code });
    const f = fixture([response]);
    assert.equal(await f.run(), response);
    assert.equal(f.calls(), 1);
    assert.deepEqual(f.waits, []);
  }
});

test("smoke login does not hide network errors", async () => {
  await assert.rejects(() => retryCompetitionSmokeLogin(() => { throw new Error("network failed"); }), /network failed/);
});
