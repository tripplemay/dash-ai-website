// Minimal HTTP contract test for a packaged standalone server.
// Usage: SMOKE_BASE_URL=http://127.0.0.1:4318 SMOKE_RELEASE_ID=... node this-file
import assert from "node:assert/strict";

const base = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:4318").replace(/\/$/, "");
const release = process.env.SMOKE_RELEASE_ID || "unknown";
const fileKey = process.env.SMOKE_FILE_KEY || "files/corecoord/brand-system/logo/ci-smoke.txt";
const fileUrl = `/${fileKey.split("/").map(encodeURIComponent).join("/")}`;

async function request(path, init) {
  return fetch(`${base}${path}`, init);
}

function setCookieValues(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") || ""];
  return values.filter(Boolean);
}

function cookieHeader(response) {
  const values = setCookieValues(response);
  const cookies = values.map((value) => value.split(";", 1)[0]).filter(Boolean);
  return cookies.join("; ");
}

function expectStatus(response, status, label) {
  assert.equal(response.status, status, `${label}: expected ${status}, got ${response.status}`);
}

const live = await request("/api/health/live");
expectStatus(live, 200, "live");
assert.equal((await live.json()).release, release, "live release id");

const ready = await request("/api/health/ready");
expectStatus(ready, 200, "ready");
assert.equal((await ready.json()).release, release, "ready release id");

const unauthenticated = await request(`/api/file${fileUrl}`);
expectStatus(unauthenticated, 401, "unauthenticated file");

const unauthenticatedDirectRoot = await request("/files");
expectStatus(unauthenticatedDirectRoot, 401, "unauthenticated direct files root");

const login = await request("/api/auth/sign-in/username", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ username: "admin", password: process.env.SMOKE_ADMIN_PASSWORD || "ci-admin-pass-123" }),
});
expectStatus(login, 200, "login");
const cookie = cookieHeader(login);
assert.ok(cookie, "login did not return a session cookie");
assert.match(setCookieValues(login).join("; "), /HttpOnly/i, "session cookie must be HttpOnly");

const file = await request(`/api/file${fileUrl}`, { headers: { Cookie: cookie } });
expectStatus(file, 200, "authenticated file");
assert.equal(await file.text(), "standalone smoke file\n", "protected file body");

const direct = await request(fileUrl, { headers: { Cookie: cookie } });
expectStatus(direct, 200, "rewritten direct file");

const browse = await request("/api/browse/files/corecoord/brand-system/logo", { headers: { Cookie: cookie } });
expectStatus(browse, 200, "directory browser");
assert.match(await browse.text(), /ci-smoke\.txt/, "directory entry");

const archive = await request("/api/download/category/brand-system", { headers: { Cookie: cookie } });
expectStatus(archive, 200, "category archive");
assert.ok((await archive.arrayBuffer()).byteLength > 0, "empty category archive");

const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const form = () => {
  const data = new FormData();
  const label = `CI smoke ${Date.now()}`;
  data.append("title", label);
  data.append("title_en", label);
  data.append("category", "brand-system");
  data.append("file", new Blob([pngBytes], { type: "image/png" }), `ci-smoke-${process.pid}.png`);
  return data;
};
const csrf = await request("/api/admin/upload", { method: "POST", headers: { Cookie: cookie }, body: form() });
expectStatus(csrf, 403, "upload csrf");
const upload = await request("/api/admin/upload", {
  method: "POST",
  headers: { Cookie: cookie, Origin: base },
  body: form(),
});
expectStatus(upload, 200, "streaming upload");

console.log("standalone smoke passed");
