// Read-only screen and image checks against the CI server's seeded account.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import ts from "typescript";

assert.equal(process.env.NODE_ENV, "production");
const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4318";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "CI smoke must use a local server");
const source = await readFile(new URL("../src/lib/campus-screen.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { CAMPUS_SCREEN_SLIDES: slides, CAMPUS_SCREEN_ASSETS: assets } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
assert.equal(slides.length, 14);
assert.equal(slides[9].id, "teaching-quality");
assert.equal(slides[11].id, "global-competitions");
assert.match(assets, /^\/_next\/static\/campus-screen\//);

const screen = "/zh/presentations/screen";
const unauthenticated = await fetch(`${base}${screen}?slide=12&paused=1`, { redirect: "manual" });
assert.equal(unauthenticated.status, 307);
assert.match(unauthenticated.headers.get("location"), /\/zh\/login\?/);

const login = await fetch(`${base}/api/auth/sign-in/username`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ username: "admin", password: process.env.SMOKE_ADMIN_PASSWORD || "ci-admin-pass-123" }),
});
assert.equal(login.status, 200);
const cookie = login.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
assert.ok(cookie);
for (const [index, slide] of slides.entries()) {
  const response = await fetch(`${base}${screen}?slide=${index + 1}&paused=1`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200, slide.id);
  const html = await response.text();
  assert.ok(html.includes(`芯坐标校区大屏，共 ${slides.length} 页`), `${slide.id}: total`);
  assert.ok(html.includes(`data-slide-id="${slide.id}"`), `${slide.id}: server-rendered slide`);
  assert.ok(html.includes(slide.title.split("\n")[0]), `${slide.id}: title`);
  assert.ok(html.includes(assets), `${slide.id}: release-owned images`);
  assert.ok(!html.includes("相关认证说明；具体认证主体"), `${slide.id}: removed note`);
}
const alias = await fetch(`${base}/zh/presentations/screen-preview?slide=12&paused=1`, { headers: { Cookie: cookie } });
assert.equal(alias.status, 200);
assert.ok((await alias.text()).includes('data-slide-id="global-competitions"'));

const images = new Set(slides.flatMap((slide) => [slide.image, ...slide.items.map((item) => item.image).filter(Boolean)]));
for (const path of images) {
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get("content-type"), /image\/webp/);
  const local = await readFile(new URL(`../public${path.replace(/^\/_next\/static/, "")}`, import.meta.url));
  const actual = Buffer.from(await response.arrayBuffer());
  const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(sha(actual), sha(local), `${path}: packaged image checksum`);
}
console.log(`campus screen smoke passed: ${slides.length} slides, ${images.size} image checksums, protected routes`);
