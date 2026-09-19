import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkTarget, diffItems, writeUpdatesToShards, completePendingUpdates } from "../scripts/competition-monitor.mjs";

const url = "https://example.invalid/news";
const item = { title: "Registration notice", date: "2026-09-19", url: "https://example.invalid/1" };
const target = { key: "demo", name: "Demo", kind: "competition", urls: [url] };

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "competition-monitor-test-"));
  const file = path.join(root, "scripts/competitions/content/demo.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const original = JSON.stringify({ slug: "demo", updates: [] });
  fs.writeFileSync(file, original);
  fs.writeFileSync(path.join(root, "scripts/competitions-content.json"), "{}");
  let state = { pages: { [url]: { hash: "before", items: [] } } };
  const dependencies = {
    loadState: () => structuredClone(state),
    saveState: (_, value) => { state = structuredClone(value); },
    checkPage: async () => ({ url, status: "ok", hash: "after", items: [item] }),
  };
  return { root, file, original, dependencies, state: () => state, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("failed validation retains an outbox and the next unchanged scan retries exactly once", async () => {
  const f = fixture();
  try {
    const first = await checkTarget(target, { write: true }, f.dependencies);
    assert.equal(first.changes[0].type, "news-added");
    const failed = writeUpdatesToShards([first], { repoRoot: f.root, run: (_, [script]) => ({ status: script.endsWith("validate-competitions.mjs") ? 1 : 0, stderr: "test failure" }) });
    assert.equal(failed.validated, false);
    assert.equal(fs.readFileSync(f.file, "utf8"), f.original);
    completePendingUpdates([first], failed, f.dependencies.saveState);
    assert.equal(f.state().pendingUpdates.length, 1);
    const retry = await checkTarget(target, { write: true }, f.dependencies);
    assert.equal(retry.status, "unchanged");
    assert.equal(retry.state.pendingUpdates.length, 1);
    const applied = writeUpdatesToShards([retry], { repoRoot: f.root, run: () => ({ status: 0 }) });
    assert.equal(applied.written.length, 1);
    completePendingUpdates([retry], applied, f.dependencies.saveState);
    assert.equal(f.state().pendingUpdates.length, 0);
    assert.equal(JSON.parse(fs.readFileSync(f.file)).updates.length, 1);
    const last = await checkTarget(target, { write: true }, f.dependencies);
    assert.equal(writeUpdatesToShards([last], { repoRoot: f.root }).written.length, 0);
  } finally { f.cleanup(); }
});

test("crash after applying content but before acknowledging is idempotent", async () => {
  const f = fixture();
  try {
    const first = await checkTarget(target, { write: true }, f.dependencies);
    writeUpdatesToShards([first], { repoRoot: f.root, run: () => ({ status: 0 }) });
    const retry = await checkTarget(target, { write: true }, f.dependencies);
    let gates = 0;
    const result = writeUpdatesToShards([retry], { repoRoot: f.root, run: () => { gates += 1; return { status: 0 }; } });
    assert.equal(result.written.length, 0);
    assert.equal(gates, 2);
    completePendingUpdates([retry], result, f.dependencies.saveState);
    assert.equal(f.state().pendingUpdates.length, 0);
    assert.equal(JSON.parse(fs.readFileSync(f.file)).updates.length, 1);
  } finally { f.cleanup(); }
});

test("merge failure rolls back both the shard and generated content without consuming the outbox", async () => {
  const f = fixture();
  try {
    const result = await checkTarget(target, { write: true }, f.dependencies);
    const merged = path.join(f.root, "scripts/competitions-content.json");
    const write = writeUpdatesToShards([result], { repoRoot: f.root, run: () => {
      fs.writeFileSync(merged, "partial merge");
      return { status: 1, stderr: "merge failed" };
    } });
    assert.equal(write.validated, false);
    assert.equal(fs.readFileSync(merged, "utf8"), "{}");
    assert.equal(fs.readFileSync(f.file, "utf8"), f.original);
    assert.equal(f.state().pendingUpdates.length, 1);
  } finally { f.cleanup(); }
});

test("same-URL revisions are detected and queued for review rather than overwriting curated content", async () => {
  assert.deepEqual(diffItems([item], [{ ...item, title: "New deadline" }]).updated.map((entry) => entry.title), ["New deadline"]);
  const f = fixture();
  try {
    await checkTarget(target, { write: true }, f.dependencies);
    const revised = await checkTarget(target, { write: true }, { ...f.dependencies, checkPage: async () => ({ url, status: "ok", hash: "new", items: [{ ...item, date: "2026-09-20" }] }) });
    assert.equal(revised.changes[0].type, "news-updated");
    assert.equal(f.state().pendingReviews.length, 1);
    assert.equal(f.state().pendingReviews[0].date, "2026-09-20");
  } finally { f.cleanup(); }
});

test("no-write scans leave the persisted baseline and outbox untouched", async () => {
  const f = fixture();
  try {
    const before = structuredClone(f.state());
    await checkTarget(target, { write: false }, f.dependencies);
    assert.deepEqual(f.state(), before);
    assert.equal(fs.readFileSync(f.file, "utf8"), f.original);
  } finally { f.cleanup(); }
});

test("temporary source failure preserves pending work and the last good snapshot", async () => {
  const f = fixture();
  try {
    await checkTarget(target, { write: true }, f.dependencies);
    await checkTarget(target, { write: true }, { ...f.dependencies, checkPage: async () => ({ url, status: "error", error: "offline" }) });
    assert.equal(f.state().pendingUpdates.length, 1);
    assert.equal(f.state().pages[url].items.length, 1);
  } finally { f.cleanup(); }
});

test("a missing shard fails without acknowledging pending work", async () => {
  const f = fixture();
  try {
    const result = await checkTarget(target, { write: true }, f.dependencies);
    fs.unlinkSync(f.file);
    const write = writeUpdatesToShards([result], { repoRoot: f.root });
    assert.equal(write.validated, false);
    completePendingUpdates([result], write, f.dependencies.saveState);
    assert.equal(f.state().pendingUpdates.length, 1);
  } finally { f.cleanup(); }
});
