import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { REGISTRATION_STAGE_RE, type Competition, type CompetitionUpdate } from "./competition-domain.ts";

export interface CompetitionFollow {
  slug: string;
  deadlineReminders: boolean;
  updateReminders: boolean;
}

interface FollowRow {
  competition_slug: string;
  deadline_reminders: number;
  update_reminders: number;
  update_baseline: string;
}

export interface CompetitionReminder {
  key: string;
  slug: string;
  nameZh: string;
  nameEn?: string;
  kind: "deadline" | "update";
  title: string;
  date: string;
  daysLeft?: number;
  read: boolean;
}

export interface CompetitionTrackingSnapshot {
  available: boolean;
  follows: CompetitionFollow[];
  reminders: CompetitionReminder[];
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function competitionUpdateKey(update: CompetitionUpdate) {
  return digest([update.url ?? "", update.date, update.title, update.source]);
}

function officialUpdateKeys(item: Competition) {
  return item.updates.filter((update) => update.source === "official").map(competitionUpdateKey);
}

export function competitionReminderCandidates(items: Competition[], rows: FollowRow[], today: string): Omit<CompetitionReminder, "read">[] {
  const bySlug = new Map(items.map((item) => [item.slug, item]));
  const reminders: Omit<CompetitionReminder, "read">[] = [];
  for (const row of rows) {
    const item = bySlug.get(row.competition_slug);
    if (!item) continue;
    const common = { slug: item.slug, nameZh: item.nameZh, nameEn: item.nameEn };
    if (row.deadline_reminders) {
      for (const stage of item.schedule) {
        if (stage.completed || !REGISTRATION_STAGE_RE.test(stage.stage) || !stage.end) continue;
        const daysLeft = Math.round((Date.parse(stage.end + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86_400_000);
        if (daysLeft < 0 || daysLeft > 7) continue;
        // Catch up on the latest threshold, rather than flooding returning users with 7/3/1 duplicates.
        const threshold = daysLeft <= 1 ? 1 : daysLeft <= 3 ? 3 : 7;
        reminders.push({ ...common, key: digest([item.slug, stage.stage, stage.end, threshold]), kind: "deadline", title: stage.stage, date: stage.end, daysLeft });
      }
    }
    if (row.update_reminders) {
      const baseline = new Set<string>(JSON.parse(row.update_baseline));
      for (const update of item.updates) {
        if (update.source !== "official" || update.date > today || baseline.has(competitionUpdateKey(update))) continue;
        reminders.push({ ...common, key: digest([item.slug, competitionUpdateKey(update)]), kind: "update", title: update.title, date: update.date });
      }
    }
  }
  return [...new Map(reminders.map((reminder) => [reminder.key, reminder])).values()].sort((a, b) =>
    (a.kind === "deadline" ? 0 : 1) - (b.kind === "deadline" ? 0 : 1) ||
    (a.kind === "deadline" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) || a.key.localeCompare(b.key)).slice(0, 100);
}

/** All access is scoped to the verified session id; the caller never supplies an owner from JSON. */
export function createCompetitionTrackingStore(db: Database.Database, items: Competition[]) {
  const bySlug = new Map(items.map((item) => [item.slug, item]));
  const rows = (userId: string) => db.prepare("SELECT * FROM competition_follows WHERE user_id = ?").all(userId) as FollowRow[];

  function snapshot(userId: string, today: string): CompetitionTrackingSnapshot {
    const follows = rows(userId);
    const read = new Set((db.prepare("SELECT reminder_key FROM competition_reminder_reads WHERE user_id = ?").all(userId) as { reminder_key: string }[]).map((row) => row.reminder_key));
    return {
      available: true,
      follows: follows.filter((row) => bySlug.has(row.competition_slug)).map((row) => ({ slug: row.competition_slug, deadlineReminders: Boolean(row.deadline_reminders), updateReminders: Boolean(row.update_reminders) })),
      reminders: competitionReminderCandidates(items, follows, today).map((item) => ({ ...item, read: read.has(item.key) })),
    };
  }

  function update(userId: string, slug: string, value: { following: boolean; deadlineReminders?: boolean; updateReminders?: boolean }) {
    const item = bySlug.get(slug);
    if (!item) throw new Error("UNKNOWN_COMPETITION");
    db.transaction(() => {
      if (!value.following) {
        db.prepare("DELETE FROM competition_reminder_reads WHERE user_id = ? AND competition_slug = ?").run(userId, slug);
        db.prepare("DELETE FROM competition_follows WHERE user_id = ? AND competition_slug = ?").run(userId, slug);
        return;
      }
      const previous = db.prepare("SELECT * FROM competition_follows WHERE user_id = ? AND competition_slug = ?").get(userId, slug) as FollowRow | undefined;
      const now = new Date().toISOString();
      const deadlines = value.deadlineReminders ?? Boolean(previous?.deadline_reminders);
      const updates = value.updateReminders ?? Boolean(previous?.update_reminders);
      // Enabling/re-enabling notices starts from the current archive, without sending historical news.
      const baseline = updates && previous?.update_reminders ? previous.update_baseline : JSON.stringify(officialUpdateKeys(item));
      db.prepare(`INSERT INTO competition_follows (user_id, competition_slug, deadline_reminders, update_reminders, update_baseline, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, competition_slug) DO UPDATE SET
        deadline_reminders=excluded.deadline_reminders, update_reminders=excluded.update_reminders,
        update_baseline=excluded.update_baseline, updated_at=excluded.updated_at`)
        .run(userId, slug, Number(deadlines), Number(updates), baseline, now, now);
    })();
  }

  function markRead(userId: string, keys: string[], today: string) {
    const current = new Map(competitionReminderCandidates(items, rows(userId), today).map((item) => [item.key, item]));
    if (keys.some((key) => !current.has(key))) return false;
    db.transaction(() => {
      const insert = db.prepare("INSERT OR IGNORE INTO competition_reminder_reads (user_id, competition_slug, reminder_key, read_at) VALUES (?, ?, ?, ?)");
      for (const key of keys) insert.run(userId, current.get(key)!.slug, key, new Date().toISOString());
    })();
    return true;
  }

  return { snapshot, update, markRead };
}
