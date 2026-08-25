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

const adminPage = await request("/en/admin", { headers: { Cookie: cookie } });
expectStatus(adminPage, 200, "admin page");
const adminHtml = await adminPage.text();
assert.match(adminHtml, /Admin console/, "admin context navigation");
assert.match(adminHtml, /Primary navigation/, "shared site navigation");
assert.match(adminHtml, /Admin overview/, "admin dashboard content");

const contentPage = await request("/en/admin/content", { headers: { Cookie: cookie } });
expectStatus(contentPage, 200, "content governance page");
const contentHtml = await contentPage.text();
assert.match(contentHtml, /Content governance|内容治理/i, "content governance page content");

const unauthenticatedContent = await request("/api/v1/content?type=course");
expectStatus(unauthenticatedContent, 401, "unauthenticated content catalogue");

const unauthenticatedLearning = await request("/api/v1/learning-events?courseSlug=drawing");
expectStatus(unauthenticatedLearning, 401, "unauthenticated learning events");

const file = await request(`/api/file${fileUrl}`, { headers: { Cookie: cookie } });
expectStatus(file, 200, "authenticated file");
assert.equal(await file.text(), "standalone smoke file\n", "protected file body");

const direct = await request(fileUrl, { headers: { Cookie: cookie } });
expectStatus(direct, 200, "rewritten direct file");

let folderId = null;
let entriesBody = null;
for (const candidate of Array.from({ length: 64 }, (_, index) => index + 1)) {
  const entries = await request(`/api/resources/${candidate}/entries`, { headers: { Cookie: cookie } });
  if (entries.status !== 200) continue;
  const body = await entries.json();
  if (body.entries?.some((entry) => entry.name === "ci-smoke.txt")) {
    folderId = candidate;
    entriesBody = body;
    break;
  }
}
assert.ok(folderId, "seeded folder resource was not found");
assert.ok(entriesBody.entries.some((entry) => entry.name === "ci-smoke.txt"), "directory entry");
assert.equal(entriesBody.entries.find((entry) => entry.name === "ci-smoke.txt").previewKind, "text", "text preview metadata");
const nestedDirectory = entriesBody.entries.find((entry) => entry.kind === "directory");
assert.ok(nestedDirectory, "nested directory metadata");
const nested = await request(`/api/resources/${folderId}/entries?path=${encodeURIComponent(nestedDirectory.relativePath)}`, { headers: { Cookie: cookie } });
expectStatus(nested, 200, "nested directory entries");
assert.match(JSON.stringify(await nested.json()), /ci-nested\.txt/, "nested directory entry");
const oldBrowse = await request("/api/browse/files/corecoord/brand-system/logo", { headers: { Cookie: cookie } });
expectStatus(oldBrowse, 404, "legacy directory browser removed");

const textPreview = await request(`/api/file${fileUrl}?mode=preview`, { headers: { Cookie: cookie } });
expectStatus(textPreview, 200, "text preview");
assert.match(textPreview.headers.get("content-type") || "", /text\/plain/i, "text preview content type");
assert.match(textPreview.headers.get("content-disposition") || "", /^inline/i, "text preview disposition");
assert.equal(await textPreview.text(), "standalone smoke file\n", "text preview body");

const svgKey = "files/corecoord/brand-system/logo/ci-smoke.svg";
const svgUrl = `/${svgKey.split("/").map(encodeURIComponent).join("/")}`;
const svgPreview = await request(`/api/file${svgUrl}?mode=preview`, { headers: { Cookie: cookie } });
expectStatus(svgPreview, 200, "svg preview");
assert.match(svgPreview.headers.get("content-type") || "", /image\/svg\+xml/i, "svg preview content type");
assert.match(svgPreview.headers.get("content-disposition") || "", /^inline/i, "svg preview disposition");

const folderArchive = await request(`/api/download/${folderId}`, { headers: { Cookie: cookie } });
expectStatus(folderArchive, 200, "folder archive");
assert.match(folderArchive.headers.get("content-type") || "", /application\/zip/i, "folder archive type");
assert.ok((await folderArchive.arrayBuffer()).byteLength > 0, "empty folder archive");

const contentCatalogue = await request("/api/v1/content?type=course&locale=zh&status=all&limit=5", {
  headers: { Cookie: cookie },
});
expectStatus(contentCatalogue, 200, "content catalogue");
const contentCatalogueBody = await contentCatalogue.json();
assert.ok(Array.isArray(contentCatalogueBody.data), "content catalogue data array");

const contentSlug = `ci-smoke-${Date.now()}-${process.pid}`;
const contentPayload = {
  kind: "smoke",
  title: "Standalone smoke content",
  checkedAt: new Date().toISOString(),
};
const contentCsrf = await request("/api/v1/content", {
  method: "POST",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "work", slug: contentSlug, locale: "en", payload: contentPayload }),
});
expectStatus(contentCsrf, 403, "content csrf");
const contentCreate = await request("/api/v1/content", {
  method: "POST",
  headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "work", slug: contentSlug, locale: "en", payload: contentPayload }),
});
expectStatus(contentCreate, 201, "content draft create");
const contentCreateBody = await contentCreate.json();
assert.equal(contentCreateBody.data?.status, "draft", "content draft status");
assert.equal(contentCreateBody.data?.revision, 1, "content draft revision");
const contentId = contentCreateBody.data?.id;
assert.equal(typeof contentId, "string", "content draft id");

const contentUpdateCsrf = await request(`/api/v1/content/${encodeURIComponent(contentId)}`, {
  method: "PATCH",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ payload: { ...contentPayload, revisionCheck: true }, expectedRevision: 1 }),
});
expectStatus(contentUpdateCsrf, 403, "content update csrf");
const contentUpdate = await request(`/api/v1/content/${encodeURIComponent(contentId)}`, {
  method: "PATCH",
  headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({ payload: { ...contentPayload, revisionCheck: true }, expectedRevision: 1 }),
});
expectStatus(contentUpdate, 200, "content revision update");
const contentUpdateBody = await contentUpdate.json();
assert.equal(contentUpdateBody.data?.revision, 2, "content revision number");

for (const status of ["review", "published"]) {
  const transition = await request(`/api/v1/content/${encodeURIComponent(contentId)}`, {
    method: "PATCH",
    headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  expectStatus(transition, 200, `content ${status} transition`);
  assert.equal((await transition.json()).data?.status, status, `content ${status} status`);
}

const contentDetail = await request(`/api/v1/content/${encodeURIComponent(contentId)}`, {
  headers: { Cookie: cookie },
});
expectStatus(contentDetail, 200, "content detail");
const contentDetailBody = await contentDetail.json();
assert.equal(contentDetailBody.data?.latestRevision?.revision, 2, "content latest revision");

const learningBefore = await request("/api/v1/learning-events?courseSlug=drawing&includeProgress=1", {
  headers: { Cookie: cookie },
});
expectStatus(learningBefore, 200, "learning events catalogue");
const learningBeforeBody = await learningBefore.json();
assert.ok(Array.isArray(learningBeforeBody.data), "learning events data array");

const idempotencyKey = `ci-smoke-learning-${Date.now()}-${process.pid}`;
const learningBody = {
  courseSlug: "drawing",
  lessonNumber: 1,
  eventType: "lesson_started",
  idempotencyKey,
  payload: { source: "standalone-smoke" },
};
const learningCsrf = await request("/api/v1/learning-events", {
  method: "POST",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: JSON.stringify(learningBody),
});
expectStatus(learningCsrf, 403, "learning events csrf");
const learningCreate = await request("/api/v1/learning-events", {
  method: "POST",
  headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" },
  body: JSON.stringify(learningBody),
});
expectStatus(learningCreate, 201, "learning event create");
const learningCreateBody = await learningCreate.json();
assert.equal(learningCreateBody.replayed, false, "learning event first write");
assert.equal(learningCreateBody.data?.idempotencyKey, idempotencyKey, "learning event idempotency key");
const learningReplay = await request("/api/v1/learning-events", {
  method: "POST",
  headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" },
  body: JSON.stringify(learningBody),
});
expectStatus(learningReplay, 200, "learning event replay");
assert.equal((await learningReplay.json()).replayed, true, "learning event replay flag");

const learningAfter = await request("/api/v1/learning-events?courseSlug=drawing&includeProgress=1", {
  headers: { Cookie: cookie },
});
expectStatus(learningAfter, 200, "learning events after write");
const learningAfterBody = await learningAfter.json();
assert.ok(learningAfterBody.data.some((event) => event.idempotencyKey === idempotencyKey), "learning event persisted");
assert.equal(learningAfterBody.progress?.courseSlug, "drawing", "learning progress course");

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
