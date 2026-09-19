import assert from "node:assert/strict";
import test from "node:test";
import { buildCompetitionIcs, foldCalendarLine } from "../src/lib/competition-ics.ts";
import { competitionQueryString } from "../src/lib/competition-domain.ts";

const options = { origin: "https://example.invalid", now: new Date("2026-09-19T00:00:00Z") };
const item = { slug: "demo", nameZh: "测试", schedule: [{ stage: "报名", start: "2026-09-01", end: "2026-11-30" }], officialSite: "https://official.invalid" };
const unfold = (text) => text.replace(/\r\n /g, "");

test("ICS uses all-day dates, exclusive end and CRLF without repeating cross-month events", () => {
  const ics = buildCompetitionIcs([item], options);
  assert.match(ics, /DTSTART;VALUE=DATE:20260901\r\nDTEND;VALUE=DATE:20261201/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 1);
  assert.equal(ics.replaceAll("\r\n", "").includes("\n"), false);
  assert.match(ics, /DTSTAMP:20260919T000000Z/);
});

test("unknown dates are omitted and single boundaries are labelled as one-day milestones", () => {
  const data = { ...item, schedule: [{ stage: "未知", start: null, end: null }, { stage: "截止项目", start: null, end: "2024-02-29" }, { stage: "开始项目", start: "2026-12-31", end: null }] };
  const ics = unfold(buildCompetitionIcs([data], options));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  assert.match(ics, /DTEND;VALUE=DATE:20240301/);
  assert.match(ics, /DTEND;VALUE=DATE:20270101/);
  assert.match(ics, /结束时间待公布/);
});

test("event identity survives date revisions and distinct stage reorderings", () => {
  const uid = (value) => buildCompetitionIcs([value], options).match(/UID:([^\r]+)/)[1];
  assert.equal(uid(item), uid({ ...item, schedule: [{ ...item.schedule[0], end: "2026-12-10" }] }));
  const duplicate = buildCompetitionIcs([{ ...item, schedule: [item.schedule[0], item.schedule[0]] }], options);
  assert.equal(new Set([...duplicate.matchAll(/UID:([^\r]+)/g)].map((match) => match[1])).size, 2);
});

test("UTF-8 folding respects 75 octets without corrupting Chinese or emoji", () => {
  const text = "SUMMARY:" + "中文比赛😀".repeat(40);
  const folded = foldCalendarLine(text);
  for (const line of folded.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
  assert.equal(unfold(folded), text);
});

test("calendar text cannot inject new properties or events", () => {
  const ics = unfold(buildCompetitionIcs([{ ...item, nameZh: "Hello,world;\\\r\nBEGIN:VEVENT\nATTENDEE:bad" }], options));
  assert.match(ics, /Hello\\,world\\;\\\\\\nBEGIN:VEVENT\\nATTENDEE:bad/);
  assert.equal(ics.split("\r\n").filter((line) => line === "BEGIN:VEVENT").length, 1);
  assert.ok(ics.includes("一次性导出"));
});

test("followed-only query survives detail return without arbitrary parameters", () => {
  assert.equal(competitionQueryString(new URLSearchParams("following=1&month=2026-11&from=//bad")), "following=1");
});
