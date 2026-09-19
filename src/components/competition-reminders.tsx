"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCompetitionTracking } from "./competition-tracking-provider";
import { CompetitionFollowButton, CompetitionReminderPreferences, CompetitionCalendarExport } from "./competition-follow-controls";

export function CompetitionReminders({ names }: { names: Array<{ slug: string; nameZh: string; nameEn?: string }> }) {
  const t = useTranslations("competitions");
  const locale = useLocale();
  const tracking = useCompetitionTracking();
  const [unreadOnly, setUnreadOnly] = useState(true);
  const unread = tracking.reminders.filter((item) => !item.read);
  const reminders = unreadOnly ? unread : tracking.reminders;
  const control = "min-h-11 rounded-md border border-neutral-200 bg-card px-3 py-2 text-sm font-bold text-indigo-800 disabled:opacity-50";
  return <div className="min-w-0 space-y-7 px-5 py-6 sm:px-7">
    <section aria-labelledby="reminder-inbox-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="reminder-inbox-title" className="text-xl font-extrabold text-indigo-900">{t("reminderInbox")}</h2>
        <button type="button" className={control} disabled={!unread.length || tracking.busy} onClick={() => { void tracking.markRead(unread.map((item) => item.key)); }}>{t("markAllRead")}</button>
      </div>
      <p className="mt-2 text-sm leading-6 text-neutral-600">{t("reminderScopeNote")}</p>
      <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} className="size-4 accent-indigo-700" />{t("unreadCount", { count: unread.length })}
      </label>
      {!reminders.length ? <p className="rounded-xl border border-dashed border-neutral-300 bg-card p-5 text-sm leading-7 text-neutral-600">{t("remindersEmpty")}</p> : <ul className="grid min-w-0 grid-cols-1 gap-3">
        {reminders.map((reminder) => <li key={reminder.key} className="min-w-0 rounded-xl border border-neutral-200 bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className={reminder.kind === "deadline" ? "font-bold text-coral-800" : "font-bold text-indigo-800"}>
              {reminder.kind === "deadline" ? (reminder.daysLeft === 0 ? t("deadlineToday") : t("daysLeft", { count: reminder.daysLeft! })) : t("officialUpdateReminder")}
            </span>
            <span className="text-neutral-600">{reminder.date}</span>
          </div>
          <h3 className="mt-2 font-extrabold text-indigo-900"><Link href={`/competitions/${reminder.slug}#${reminder.kind === "deadline" ? "schedule" : "updates"}`} className="leading-7 hover:underline">{locale === "en" && reminder.nameEn ? reminder.nameEn : reminder.nameZh}</Link></h3>
          <p className="mt-1 text-sm leading-6 text-neutral-700">{reminder.title}</p>
          {reminder.read ? <p className="mt-3 text-xs text-neutral-600">{t("read")}</p> : <button type="button" disabled={tracking.busy} onClick={() => { void tracking.markRead([reminder.key]); }} className={`${control} mt-3`}>{t("markRead")}</button>}
        </li>)}
      </ul>}
    </section>
    <section aria-labelledby="followed-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="followed-title" className="text-xl font-extrabold text-indigo-900">{t("myFollowing", { count: tracking.follows.length })}</h2>
        <CompetitionCalendarExport />
      </div>
      <p className="mt-2 text-sm leading-6 text-neutral-600">{t("cancelReminderNote")}</p>
      <p className="mt-1 text-xs leading-6 text-neutral-600">{t("exportNote")}</p>
      {!tracking.follows.length ? <div className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-card p-5 text-sm text-neutral-600">
        {t("followingEmpty")} <Link href="/competitions" className="inline-flex min-h-11 items-center px-2 font-bold text-indigo-800 underline">{t("listEntry")}</Link>
      </div> : <ul className="mt-4 grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
        {tracking.follows.map((follow) => {
          const item = names.find((item) => item.slug === follow.slug);
          if (!item) return null;
          const name = locale === "en" && item.nameEn ? item.nameEn : item.nameZh;
          return <li key={follow.slug} className="min-w-0 rounded-xl border border-neutral-200 bg-card p-4">
            <h3 className="mb-3 font-extrabold leading-7 text-indigo-900"><Link href={`/competitions/${follow.slug}?from=following%3D1`} className="hover:underline">{name}</Link></h3>
            <CompetitionFollowButton slug={follow.slug} name={name} />
            <CompetitionReminderPreferences slug={follow.slug} />
          </li>;
        })}
      </ul>}
    </section>
  </div>;
}
