"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { QUESTION_TYPE_LABEL_KEYS, type QuestionType } from "@/lib/paper-questions-domain";
import { cn } from "@/lib/utils";

const controlClass =
  "min-h-11 rounded-md border border-neutral-200 bg-card px-3 py-2 text-[13px] font-bold text-neutral-700 transition-colors hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

type WrongItem = {
  questionId: string;
  userAnswer: string;
  answeredAt: string;
  question: {
    seq: number;
    type: QuestionType;
    stem: string;
    options: { key: string; text: string }[] | null;
    correctAnswer: string | string[];
    explanation: string | null;
    points: number;
  } | null;
  paper: { paperId: string; title: string; competition: string; slug: string } | null;
};

export function WrongBookList() {
  const t = useTranslations("competitions");
  const [items, setItems] = useState<WrongItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/practice/wrong-book", { credentials: "same-origin" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const payload = await resp.json();
        if (!cancelled) setItems(payload.items ?? payload.data ?? []);
      } catch (cause) {
        if (!cancelled) setError(String(cause));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function master(questionId: string, paperId: string | undefined) {
    if (!paperId) return;
    setMarking(questionId);
    try {
      const resp = await fetch("/api/practice/self-mark", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paperId, questionId, isCorrect: 1 }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setItems((prev) => (prev ?? []).filter((item) => item.questionId !== questionId));
    } finally {
      setMarking(null);
    }
  }

  if (error) {
    return <div className="rounded-lg border border-coral-200 bg-coral-50 p-6 text-sm text-coral-700">{error}</div>;
  }
  if (items === null) {
    return (
      <div className="flex items-center gap-2 p-10 text-sm text-neutral-500">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        {t("practiceLoading")}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-card p-10 text-center">
        <p className="text-sm leading-7 text-neutral-600">{t("wrongBookEmpty")}</p>
      </div>
    );
  }

  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.questionId} className="rounded-lg border border-neutral-200 bg-card p-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {item.question && (
              <>
                <span className="rounded bg-indigo-700 px-2 py-0.5 font-mono text-[11px] font-bold text-white">{item.question.seq}</span>
                <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                  {t(QUESTION_TYPE_LABEL_KEYS[item.question.type])}
                </span>
              </>
            )}
            {item.paper && (
              <Link href={`/competitions/papers/${item.paper.paperId}/practice`} className="rounded bg-coral-50 px-2 py-0.5 text-[11px] font-bold text-coral-700 transition-colors hover:bg-coral-100">
                {item.paper.competition} · {item.paper.title.slice(0, 30)}
              </Link>
            )}
            <time className="ml-auto font-mono text-[11px] text-neutral-400">{item.answeredAt.slice(0, 10)}</time>
          </div>
          {item.question && (
            <>
              <p className="mt-2.5 text-[14px] leading-7 font-bold whitespace-pre-line text-neutral-800">{item.question.stem}</p>
              <div className="mt-3 grid gap-2 rounded-md border border-neutral-100 bg-neutral-50 p-3 text-[13px] leading-6 sm:grid-cols-2">
                <div>
                  <div className="font-bold text-neutral-500">{t("wrongBookMyAnswer")}</div>
                  <div className="mt-0.5 whitespace-pre-line text-coral-700">{item.userAnswer || "—"}</div>
                </div>
                <div>
                  <div className="font-bold text-neutral-500">{t("practiceCorrectAnswer")}</div>
                  <div className="mt-0.5 whitespace-pre-line text-emerald-700">
                    {Array.isArray(item.question.correctAnswer) ? item.question.correctAnswer.join("") : item.question.correctAnswer}
                  </div>
                </div>
              </div>
              {item.question.explanation && (
                <p className="mt-2 text-[12.5px] leading-6 whitespace-pre-line text-neutral-600">{item.question.explanation}</p>
              )}
            </>
          )}
          <div className="mt-3">
            <button
              type="button"
              disabled={marking === item.questionId || !item.paper}
              onClick={() => master(item.questionId, item.paper?.paperId)}
              className={cn(controlClass, "inline-flex items-center gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700")}
            >
              {marking === item.questionId ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="size-4" />}
              {t("wrongBookMaster")}
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}
