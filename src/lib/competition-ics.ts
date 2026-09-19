import { createHash } from "node:crypto";
import type { Competition } from "./competition-domain";

export function escapeCalendarText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

export function foldCalendarLine(line: string) {
  let folded = "";
  let octets = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character, "utf8");
    if (octets + size > 75) { folded += "\r\n "; octets = 1; }
    folded += character;
    octets += size;
  }
  return folded;
}

function dayAfter(value: string) {
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** RFC 5545: all-day dates, exclusive DTEND, UTF-8 octet folding and stable event identity. */
export function buildCompetitionIcs(items: Competition[], { locale = "zh", origin, now = new Date() }: { locale?: string; origin: string; now?: Date }) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CORECOORD//Competition Calendar//ZH", "CALSCALE:GREGORIAN"];
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  for (const item of items) {
    const occurrences = new Map<string, number>();
    for (const stage of item.schedule) {
      const ordinal = occurrences.get(stage.stage) ?? 0;
      occurrences.set(stage.stage, ordinal + 1);
      if (!stage.start && !stage.end) continue;
      const start = stage.start ?? stage.end!;
      const end = stage.end ?? stage.start!;
      const identity = createHash("sha256").update(JSON.stringify([item.slug, stage.stage, ordinal])).digest("hex");
      const name = locale === "en" && item.nameEn ? item.nameEn : item.nameZh;
      const boundary = !stage.start ? (locale === "en" ? "Deadline" : "截止") : !stage.end ? (locale === "en" ? "Starts; end unconfirmed" : "开始；结束时间待公布") : "";
      const note = locale === "en" ? "One-time export, not a subscription. Dates follow the official Beijing-time schedule; confirm details on the official site." : "一次性导出，不会自动同步。日期按官方北京时间赛程记录，具体时间与规则以官网为准。";
      lines.push("BEGIN:VEVENT", `UID:${identity}@competitions.corecoord`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${start.replaceAll("-", "")}`, `DTEND;VALUE=DATE:${dayAfter(end).replaceAll("-", "")}`,
        `SUMMARY:${escapeCalendarText([name, stage.stage, boundary].filter(Boolean).join(" · "))}`,
        `DESCRIPTION:${escapeCalendarText([note, stage.note, item.officialSite].filter(Boolean).join("\n"))}`,
        `URL:${new URL(`/${locale === "en" ? "en" : "zh"}/competitions/${encodeURIComponent(item.slug)}`, origin).href}`,
        "TRANSP:TRANSPARENT", "END:VEVENT");
    }
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldCalendarLine).join("\r\n") + "\r\n";
}
