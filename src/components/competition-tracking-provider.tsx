"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { CompetitionTrackingSnapshot } from "@/lib/competition-tracking";

type TrackingContext = CompetitionTrackingSnapshot & {
  busy: boolean;
  update: (slug: string, value: { following: boolean; deadlineReminders?: boolean; updateReminders?: boolean }) => Promise<void>;
  markRead: (keys: string[]) => Promise<void>;
};
const Context = createContext<TrackingContext | null>(null);

export function CompetitionTrackingProvider({ initial, children }: { initial: CompetitionTrackingSnapshot; children: React.ReactNode }) {
  const t = useTranslations("competitions");
  const [snapshot, setSnapshot] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const writing = useRef(false);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    if (writing.current || document.visibilityState === "hidden") return;
    const current = ++generation.current;
    try {
      const response = await fetch("/api/competitions/tracking", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (current !== generation.current) return;
      if (response.status === 401) setSnapshot({ available: false, follows: [], reminders: [] });
      if (!response.ok) throw new Error("tracking unavailable");
      const next: CompetitionTrackingSnapshot = await response.json();
      if (current === generation.current) { setSnapshot(next); setError(false); }
    } catch { if (current === generation.current) setError(true); }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => { void refresh(); }, 60_000);
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); generation.current += 1; };
  }, [refresh]);

  async function mutate(method: "PUT" | "POST", body: unknown) {
    if (writing.current) return;
    writing.current = true;
    generation.current += 1;
    setBusy(true); setError(false); setSaved(false);
    try {
      const response = await fetch("/api/competitions/tracking", { method, signal: AbortSignal.timeout(15_000), headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (response.status === 401) setSnapshot({ available: false, follows: [], reminders: [] });
      if (!response.ok) throw new Error("save failed");
      setSnapshot(await response.json()); setSaved(true);
    } catch { setError(true); }
    finally { writing.current = false; setBusy(false); }
  }

  return <Context.Provider value={{ ...snapshot, busy, update: (slug, value) => mutate("PUT", { slug, ...value }), markRead: (keys) => mutate("POST", { keys }) }}>
    {(!snapshot.available || error) && <div role="alert" className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950">
      {t("trackingUnavailable")} <button type="button" disabled={busy} onClick={() => { void refresh(); }} className="min-h-11 px-3 font-bold underline">{t("retry")}</button>
    </div>}
    <span role="status" className="sr-only">{busy ? t("saving") : saved ? t("saved") : ""}</span>
    {children}
  </Context.Provider>;
}

export function useCompetitionTracking() {
  const context = useContext(Context);
  if (!context) throw new Error("CompetitionTrackingProvider missing");
  return context;
}
