"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, Bookmark, Download } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useCompetitionTracking } from "./competition-tracking-provider";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-card px-3 py-2 text-sm font-bold text-indigo-800 hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50";

export function CompetitionFollowButton({ slug, name }: { slug: string; name: string }) {
  const t = useTranslations("competitions");
  const tracking = useCompetitionTracking();
  const following = tracking.follows.some((item) => item.slug === slug);
  return <button type="button" aria-pressed={following} aria-label={t(following ? "unfollowNamed" : "followNamed", { name })}
    disabled={!tracking.available || tracking.busy} className={buttonClass}
    onClick={() => { void tracking.update(slug, { following: !following }); }}>
    <Bookmark aria-hidden="true" className={`size-4 ${following ? "fill-indigo-100" : ""}`} />{t(following ? "following" : "follow")}
  </button>;
}

export function CompetitionReminderPreferences({ slug }: { slug: string }) {
  const t = useTranslations("competitions");
  const tracking = useCompetitionTracking();
  const follow = tracking.follows.find((item) => item.slug === slug);
  if (!follow) return null;
  return <fieldset disabled={tracking.busy || !tracking.available} className="mt-3 space-y-1 text-sm text-neutral-700">
    <legend className="font-bold">{t("reminderPreferences")}</legend>
    <label className="flex min-h-11 cursor-pointer items-center gap-2">
      <input type="checkbox" checked={follow.deadlineReminders} onChange={(event) => { void tracking.update(slug, { following: true, deadlineReminders: event.target.checked }); }} className="size-4 accent-indigo-700" />{t("deadlineReminderOption")}
    </label>
    <label className="flex min-h-11 cursor-pointer items-center gap-2">
      <input type="checkbox" checked={follow.updateReminders} onChange={(event) => { void tracking.update(slug, { following: true, updateReminders: event.target.checked }); }} className="size-4 accent-indigo-700" />{t("updateReminderOption")}
    </label>
  </fieldset>;
}

export function CompetitionRemindersLink() {
  const t = useTranslations("competitions");
  const tracking = useCompetitionTracking();
  const count = tracking.reminders.filter((item) => !item.read).length;
  return <Link href="/competitions/reminders" className={buttonClass}>
    <Bell aria-hidden="true" className="size-4" />{t("myReminders")}{count > 0 && <span aria-label={t("unreadCount", { count })} className="rounded-full bg-coral-100 px-2 text-xs text-coral-800">{count}</span>}
  </Link>;
}

export function CompetitionCalendarExport({ scope = "followed", slug }: { scope?: "all" | "followed"; slug?: string }) {
  const t = useTranslations("competitions");
  const locale = useLocale();
  const tracking = useCompetitionTracking();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"exportError" | "exportEmpty" | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  useEffect(() => () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); }, [downloadUrl]);
  async function download() {
    setBusy(true); setError(null);
    try {
      const query = new URLSearchParams({ scope, locale });
      if (slug) query.set("slug", slug);
      const response = await fetch(`/api/competitions/calendar?${query}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("text/calendar")) {
        setError(response.status === 409 ? "exportEmpty" : "exportError"); return;
      }
      const url = URL.createObjectURL(await response.blob());
      setDownloadUrl(url);
      const link = document.createElement("a");
      link.href = url; link.download = "corecoord-competitions.ics"; document.body.appendChild(link); link.click(); link.remove();
    } catch { setError("exportError"); }
    finally { setBusy(false); }
  }
  return <div className="min-w-0">
    <button type="button" disabled={busy || !tracking.available || (scope === "followed" && !tracking.follows.length)} onClick={() => { void download(); }} className={buttonClass}>
      <Download aria-hidden="true" className="size-4" />{t(busy ? "exporting" : "exportCalendar")}
    </button>
    {downloadUrl && <p className="mt-2 text-xs leading-6 text-neutral-600">{t("exportReady")} <a href={downloadUrl} download="corecoord-competitions.ics" className="inline-flex min-h-11 items-center font-bold text-indigo-800 underline">{t("saveCalendar")}</a></p>}
    {error && <p role="alert" className="mt-1 text-sm text-coral-800">{t(error)}</p>}
  </div>;
}

export function CompetitionDetailTracking({ slug, name }: { slug: string; name: string }) {
  const t = useTranslations("competitions");
  return <section className="mx-5 mt-5 rounded-xl border border-neutral-200 bg-card p-4 sm:mx-7">
    <h2 className="text-base font-extrabold text-indigo-900">{t("followAndRemind")}</h2>
    <p className="mt-1 text-sm leading-6 text-neutral-600">{t("reminderScopeNote")}</p>
    <div className="mt-3 flex flex-wrap gap-2"><CompetitionFollowButton slug={slug} name={name} /><CompetitionRemindersLink /><CompetitionCalendarExport scope="all" slug={slug} /></div>
    <CompetitionReminderPreferences slug={slug} />
    <p className="mt-2 text-xs leading-6 text-neutral-600">{t("exportNote")}</p>
  </section>;
}
