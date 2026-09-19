import assert from "node:assert/strict";

// This mutating regression is intentionally restricted to an isolated local server and seeded accounts.
const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3618";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname), "competition smoke must not write to a remote environment");
const slug = "zuowendasai";
let assertions = 0;
function status(response, expected) { assert.equal(response.status, expected); assertions += 1; return response; }
async function login(username, password) {
  const response = await fetch(`${base}/api/auth/sign-in/username`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ username, password }) });
  status(response, 200);
  return response.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
}
const admin = await login("admin", process.env.SMOKE_ADMIN_PASSWORD || "ci-admin-pass-123");
const partner = await login("partner", process.env.SMOKE_PARTNER_PASSWORD || "ci-initial-pass-123");
const headers = (cookie) => ({ Cookie: cookie, Origin: base, "Content-Type": "application/json" });
const read = (cookie) => fetch(`${base}/api/competitions/tracking`, { headers: headers(cookie) });
const write = (cookie, body, custom = {}) => fetch(`${base}/api/competitions/tracking`, { method: "PUT", headers: { ...headers(cookie), ...custom }, body: JSON.stringify(body) });
const calendar = (cookie, query = "scope=followed") => fetch(`${base}/api/competitions/calendar?${query}`, { headers: headers(cookie) });

try {
  status(await fetch(`${base}/api/competitions/tracking`), 401);
  status(await fetch(`${base}/api/competitions/calendar`), 401);
  status(await write("", { slug, following: true }), 401);
  status(await write(admin, { slug, following: false }), 200);
  status(await write(partner, { slug, following: false }), 200);
  status(await calendar(admin), 409);
  status(await write(admin, { slug, following: true }, { Origin: "https://invalid.example" }), 403);
  status(await write(admin, { slug, following: true, userId: "someone-else" }), 400);
  status(await write(admin, { slug, following: true, deadlineReminders: "yes" }), 400);
  status(await write(admin, { slug: "not-in-the-catalog", following: true }), 404);
  status(await write(admin, { slug, following: true, payload: "x".repeat(20_000) }), 400);

  const followed = status(await write(admin, { slug, following: true }), 200);
  assert.match(followed.headers.get("cache-control"), /private.*no-store/);
  assert.deepEqual((await followed.json()).follows, [{ slug, deadlineReminders: false, updateReminders: false }]);
  status(await write(admin, { slug, following: true }), 200);
  assert.equal((await (await read(admin)).json()).follows.length, 1);
  assert.equal((await (await read(partner)).json()).follows.length, 0);
  status(await write(admin, { slug, following: true, deadlineReminders: true, updateReminders: true }), 200);
  const persisted = await (await read(admin)).json();
  assert.deepEqual(persisted.follows, [{ slug, deadlineReminders: true, updateReminders: true }]);
  assert.equal(persisted.reminders.filter((item) => item.kind === "update").length, 0, "enabling must not alert on historical news");

  const ics = status(await calendar(admin), 200);
  assert.match(ics.headers.get("content-type"), /^text\/calendar/);
  assert.match(ics.headers.get("content-disposition"), /\.ics/);
  const content = (await ics.text()).replace(/\r\n /g, "");
  assert.ok(content.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.match(content, /competitions\/zuowendasai/);
  assert.doesNotMatch(content, /competitions\/noi\r\n/);
  status(await calendar(partner), 409);
  status(await calendar(admin, "scope=all&slug=noi&locale=en"), 200);
  status(await calendar(admin, "scope=unknown"), 400);
  status(await fetch(`${base}/api/competitions/tracking`, { method: "POST", headers: headers(partner), body: JSON.stringify({ keys: ["a".repeat(64)] }) }), 409);
  status(await fetch(`${base}/api/competitions/tracking`, { method: "POST", headers: headers(admin), body: JSON.stringify({ keys: [] }) }), 200);

  for (const path of ["/zh/competitions?following=1", "/zh/competitions/reminders", "/en/competitions/calendar?following=1", `/zh/competitions/${slug}`]) {
    const response = status(await fetch(base + path, { headers: headers(admin) }), 200);
    const html = await response.text();
    assert.ok(!html.includes("TRACKING_UNAVAILABLE"));
    assert.ok(html.includes(slug), "authenticated page must include the followed competition");
  }
  status(await write(admin, { slug, following: false }), 200);
  assert.equal((await (await read(admin)).json()).follows.length, 0);
  status(await calendar(admin), 409);
  console.log(`competition HTTP smoke passed: ${assertions} status checks; real sessions, isolation, CSRF, persistence, opt-in and ICS`);
} finally {
  await write(admin, { slug, following: false });
  await write(partner, { slug, following: false });
}
