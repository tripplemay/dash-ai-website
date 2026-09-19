import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { runMigrations } from "../scripts/migrate.mjs";
import { createCompetitionTrackingStore } from "../src/lib/competition-tracking.ts";

function fixture() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec("CREATE TABLE user (id TEXT PRIMARY KEY); INSERT INTO user VALUES ('alice'), ('bob')");
  runMigrations(db);
  const item = { slug: "demo", nameZh: "测试赛事", schedule: [{ stage: "报名", start: "2026-09-01", end: "2026-09-20" }], updates: [{ date: "2026-09-10", title: "Original", source: "official", url: "https://example.invalid/news/1" }] };
  const store = createCompetitionTrackingStore(db, [item]);
  return { db, item, store };
}

test("following is idempotent, account-scoped and reminders default to off", () => {
  const { db, store } = fixture();
  try {
    store.update("alice", "demo", { following: true });
    store.update("alice", "demo", { following: true });
    assert.deepEqual(store.snapshot("alice", "2026-09-19").follows, [{ slug: "demo", deadlineReminders: false, updateReminders: false }]);
    assert.deepEqual(store.snapshot("bob", "2026-09-19").follows, []);
    assert.deepEqual(store.snapshot("alice", "2026-09-19").reminders, []);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM competition_follows").get().n, 1);
  } finally { db.close(); }
});

test("7/3/1 thresholds catch up once, keep read state within a band and expire", () => {
  const { db, store } = fixture();
  try {
    store.update("alice", "demo", { following: true, deadlineReminders: true });
    const snapshot = (date) => store.snapshot("alice", date).reminders;
    assert.equal(snapshot("2026-09-12").length, 0);
    const first = snapshot("2026-09-13")[0];
    assert.equal(first.daysLeft, 7);
    assert.equal(store.markRead("alice", [first.key], "2026-09-13"), true);
    assert.equal(snapshot("2026-09-16")[0].read, true);
    assert.equal(snapshot("2026-09-17")[0].read, false);
    assert.notEqual(snapshot("2026-09-17")[0].key, first.key);
    assert.equal(snapshot("2026-09-19").length, 1);
    assert.equal(snapshot("2026-09-20")[0].daysLeft, 0);
    assert.equal(snapshot("2026-09-21").length, 0);
  } finally { db.close(); }
});

test("unknown and completed deadlines do not produce misleading reminders", () => {
  const { db, store, item } = fixture();
  try {
    item.schedule = [{ stage: "报名", start: "2026-09-10", end: null }, { stage: "提交作品", start: null, end: "2026-09-20", completed: true }, { stage: "决赛", start: null, end: "2026-09-20" }];
    store.update("alice", "demo", { following: true, deadlineReminders: true });
    assert.equal(store.snapshot("alice", "2026-09-19").reminders.length, 0);
    item.schedule.push({ stage: "征稿", start: null, end: "2026-09-20" });
    assert.equal(store.snapshot("alice", "2026-09-19").reminders.length, 1);
  } finally { db.close(); }
});

test("revised deadlines get a new identity instead of reusing a read reminder", () => {
  const { db, store, item } = fixture();
  try {
    store.update("alice", "demo", { following: true, deadlineReminders: true });
    const original = store.snapshot("alice", "2026-09-19").reminders[0];
    store.markRead("alice", [original.key], "2026-09-19");
    item.schedule[0].end = "2026-09-21";
    const revised = store.snapshot("alice", "2026-09-19").reminders[0];
    assert.notEqual(revised.key, original.key);
    assert.equal(revised.read, false);
  } finally { db.close(); }
});

test("official update subscriptions baseline history and detect later additions or edits", () => {
  const { db, store, item } = fixture();
  try {
    store.update("alice", "demo", { following: true, updateReminders: true });
    assert.equal(store.snapshot("alice", "2026-09-19").reminders.length, 0);
    item.updates.push({ date: "2026-09-18", title: "New official news", source: "official" }, { date: "2026-09-19", title: "Media", source: "media" }, { date: "2026-09-21", title: "Future", source: "official" });
    assert.equal(store.snapshot("alice", "2026-09-19").reminders.length, 1);
    item.updates[0].title = "Corrected notice";
    assert.equal(store.snapshot("alice", "2026-09-19").reminders.length, 2);
    store.update("alice", "demo", { following: true, updateReminders: false });
    assert.equal(store.snapshot("alice", "2026-09-19").reminders.length, 0);
    store.update("alice", "demo", { following: true, updateReminders: true });
    assert.equal(store.snapshot("alice", "2026-09-19").reminders.length, 0);
  } finally { db.close(); }
});

test("read writes reject another account's or fabricated notifications", () => {
  const { db, store } = fixture();
  try {
    store.update("alice", "demo", { following: true, deadlineReminders: true });
    const key = store.snapshot("alice", "2026-09-19").reminders[0].key;
    assert.equal(store.markRead("bob", [key], "2026-09-19"), false);
    assert.equal(store.markRead("alice", ["x".repeat(64)], "2026-09-19"), false);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM competition_reminder_reads").get().n, 0);
    store.markRead("alice", [key], "2026-09-19");
    store.markRead("alice", [key], "2026-09-19");
    assert.equal(db.prepare("SELECT COUNT(*) n FROM competition_reminder_reads").get().n, 1);
  } finally { db.close(); }
});

test("unfollowing deletes preferences and read history without affecting another account", () => {
  const { db, store } = fixture();
  try {
    for (const user of ["alice", "bob"]) store.update(user, "demo", { following: true, deadlineReminders: true });
    store.markRead("alice", [store.snapshot("alice", "2026-09-19").reminders[0].key], "2026-09-19");
    store.update("alice", "demo", { following: false });
    assert.equal(store.snapshot("alice", "2026-09-19").follows.length, 0);
    assert.equal(store.snapshot("bob", "2026-09-19").follows.length, 1);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM competition_reminder_reads").get().n, 0);
  } finally { db.close(); }
});

test("migrations are repeatable and preserve subscriptions; account deletion cascades", () => {
  const { db, store } = fixture();
  try {
    store.update("alice", "demo", { following: true, deadlineReminders: true });
    const key = store.snapshot("alice", "2026-09-19").reminders[0].key;
    store.markRead("alice", [key], "2026-09-19");
    runMigrations(db);
    assert.equal(store.snapshot("alice", "2026-09-19").reminders[0].read, true);
    db.prepare("DELETE FROM user WHERE id = ?").run("alice");
    assert.equal(db.prepare("SELECT COUNT(*) n FROM competition_follows").get().n, 0);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM competition_reminder_reads").get().n, 0);
  } finally { db.close(); }
});
