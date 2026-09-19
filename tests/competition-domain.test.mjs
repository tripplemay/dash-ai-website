import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  competitionDateKey, deriveCompetitionStatus, currentScheduleStage, nextScheduleStage,
  registrationCountdown, buildCompetitionCalendar, competitionQueryString,
  readCompetitionQuery, selectCompetitions, latestUpdate,
} from "../src/lib/competition-domain.ts";
import { isValidDate } from "../scripts/competition-lib.mjs";

const { competitions } = JSON.parse(readFileSync(new URL("../scripts/competitions-content.json", import.meta.url)));
const find = (slug) => competitions.find((item) => item.slug === slug);
const scheduled = (schedule) => ({ schedule });
const stage = (start, end, name = "报名") => ({ stage: name, start, end });

test("unknown future stages do not end a season", () => {
  for (const slug of ["ccho", "nysim"]) {
    assert.equal(deriveCompetitionStatus(find(slug), "2026-09-19"), "pending");
  }
  assert.equal(deriveCompetitionStatus(scheduled([stage("2026-01-01", "2026-01-02"), stage(null, null)]), "2026-01-03"), "pending");
  assert.equal(deriveCompetitionStatus(scheduled([stage("2026-01-01", "2026-01-02")]), "2026-01-03"), "finished");
  assert.equal(deriveCompetitionStatus(scheduled([]), "2026-01-03"), "tbd");
});

test("single date boundaries never invent an open window or a closing date", () => {
  const startsOnly = scheduled([stage("2026-09-20", null)]);
  assert.equal(registrationCountdown(startsOnly, "2026-09-19"), null);
  assert.equal(deriveCompetitionStatus(startsOnly, "2026-09-21"), "pending");
  const endsOnly = scheduled([stage(null, "2026-09-20")]);
  assert.equal(deriveCompetitionStatus(endsOnly, "2026-09-19"), "tbd");
  assert.equal(registrationCountdown(endsOnly, "2026-09-19").daysLeft, 1);
  assert.equal(deriveCompetitionStatus(endsOnly, "2026-09-21"), "finished");
});

test("the next stage is not the current stage", () => {
  const item = find("eco-essay");
  assert.equal(currentScheduleStage(item, "2026-09-19"), null);
  assert.equal(nextScheduleStage(item, "2026-09-19").start, "2026-09-20");
  assert.equal(deriveCompetitionStatus(item, "2026-09-20"), "registration");
  assert.equal(currentScheduleStage(item, "2026-09-20").start, "2026-09-20");
});

test("deadline boundaries are inclusive and quiz days are not registration", () => {
  const item = scheduled([stage("2026-09-01", "2026-09-20")]);
  assert.equal(deriveCompetitionStatus(item, "2026-09-20"), "registration");
  assert.equal(registrationCountdown(item, "2026-09-20").daysLeft, 0);
  assert.equal(registrationCountdown(item, "2026-09-21"), null);
  assert.equal(deriveCompetitionStatus(scheduled([stage("2026-09-20", "2026-09-20", "在线答题")]), "2026-09-20"), "ongoing");
});

test("one instant uses Beijing time in every process timezone", () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ["UTC", "Asia/Shanghai", "America/Los_Angeles"]) {
      process.env.TZ = zone;
      const now = new Date("2026-09-19T17:00:00Z");
      assert.equal(competitionDateKey(now), "2026-09-20");
      assert.equal(deriveCompetitionStatus(find("eco-essay"), now), "registration");
    }
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
});

test("calendar includes current months and a distinct deadline", () => {
  const item = find("zuowendasai");
  const calendar = new Map(buildCompetitionCalendar([item]));
  assert.ok(calendar.get("2026-09").some((entry) => entry.kind === "continues"));
  assert.ok(calendar.get("2026-11").some((entry) => entry.kind === "end" && entry.sortDate === "2026-11-30"));
  assert.ok(calendar.get("2026-08").some((entry) => entry.kind === "start"));
  const all = [...calendar.values()].flat();
  assert.equal(new Set(all.map((entry) => entry.id)).size, all.length);
});

test("calendar does not invent an end for start-only stages", () => {
  const entries = buildCompetitionCalendar([{ slug: "open", schedule: [stage("2026-01-20", null), stage(null, null)] }]).flatMap(([, entries]) => entries);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].kind, "start");
});

test("strict date validation accepts leap days only in leap years", () => {
  for (const value of ["2026-02-30", "2026-02-29", "2026-04-31", "2026-13-01", "2026-1-01"]) assert.equal(isValidDate(value), false);
  for (const value of ["2024-02-29", "2026-01-31"]) assert.equal(isValidDate(value), true);
});

test("query state round trips and discards untrusted or unknown navigation parameters", () => {
  const params = new URLSearchParams({ q: "机器人", category: "natural-science", grade: "小学", status: "pending", sort: "updated", limit: "24", from: "//evil.test" });
  const clean = competitionQueryString(params);
  assert.deepEqual(readCompetitionQuery(new URLSearchParams(clean)), readCompetitionQuery(params));
  assert.equal(new URLSearchParams(clean).has("from"), false);
  const invalid = readCompetitionQuery(new URLSearchParams("category=invalid&status=no&sort=no&limit=-1"));
  assert.equal(invalid.category, null);
  assert.equal(invalid.status, null);
  assert.equal(invalid.sort, "recommended");
  assert.equal(invalid.limit, 12);
});

test("search, filtering and sorting use real data without mutating the catalog", () => {
  const items = competitions.map((item) => ({ ...item, latest: latestUpdate(item) }));
  const before = items.map((item) => item.slug);
  const select = (query) => selectCompetitions(items, readCompetitionQuery(new URLSearchParams(query)), "2026-09-19");
  assert.equal(select("status=registration")[0].slug, "zuowendasai");
  assert.equal(select("status=registration&grade=小学").length, 0);
  assert.ok(select("q=NOI").some((item) => item.slug === "noi"));
  assert.ok(select("q=中国化学会").some((item) => item.slug === "ccho"));
  assert.equal(select("sort=official")[0].moeListIndex, 1);
  assert.deepEqual(items.map((item) => item.slug), before);
});
