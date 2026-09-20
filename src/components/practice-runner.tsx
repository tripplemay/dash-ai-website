"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, CircleAlert, Flag, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { QUESTION_TYPE_LABEL_KEYS, type PaperQuestion } from "@/lib/paper-questions-domain";
import { cn } from "@/lib/utils";

type SafeQuestion = Omit<PaperQuestion, "answer" | "explanation">;

type AnsweredState = {
  userAnswer: string;
  isCorrect: 0 | 1 | null;
  correctAnswer: string | string[];
  explanation: string | null;
  selfMarked?: boolean;
};

type SessionInfo = {
  sessionId: string;
  status: "active" | "finished";
  answeredCount: number;
  correctCount: number;
  score: number | null;
};

const controlClass =
  "min-h-11 rounded-md border border-neutral-200 bg-card px-3 py-2 text-[13px] font-bold text-neutral-700 transition-colors hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

function newIdempotencyKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function VerdictBadge({ isCorrect, selfMarked }: { isCorrect: 0 | 1 | null; selfMarked?: boolean }) {
  const t = useTranslations("competitions");
  if (isCorrect === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
        <CircleAlert aria-hidden="true" className="size-3" />
        {t("practicePendingSelf")}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold",
        isCorrect === 1 ? "bg-emerald-50 text-emerald-700" : "bg-coral-50 text-coral-700"
      )}
    >
      <CheckCircle2 aria-hidden="true" className="size-3" />
      {isCorrect === 1 ? t("practiceCorrect") : t("practiceWrong")}
      {selfMarked ? ` · ${t("practiceSelfMarked")}` : ""}
    </span>
  );
}

function AnswerPanel({
  question,
  answered,
  onSelfMark,
  selfMarking,
}: {
  question: SafeQuestion;
  answered: AnsweredState;
  onSelfMark: (questionId: string, isCorrect: 0 | 1) => void;
  selfMarking: boolean;
}) {
  const t = useTranslations("competitions");
  return (
    <div className="mt-3 rounded-md border border-neutral-100 bg-neutral-50 p-3 text-[13px] leading-6">
      <div className="flex flex-wrap items-center gap-2">
        <VerdictBadge isCorrect={answered.isCorrect} selfMarked={answered.selfMarked} />
        {question.type !== "essay" && (
          <span className="font-bold text-emerald-700">
            {t("practiceCorrectAnswer")}：{Array.isArray(answered.correctAnswer) ? answered.correctAnswer.join("") : answered.correctAnswer}
          </span>
        )}
      </div>
      {question.type === "essay" && (
        <div className="mt-2">
          <div className="font-bold text-neutral-700">{t("practiceReferenceAnswer")}</div>
          <p className="mt-1 whitespace-pre-line text-neutral-600">{String(answered.correctAnswer)}</p>
          {answered.isCorrect === null && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={selfMarking}
                onClick={() => onSelfMark(question.id, 1)}
                className={cn(controlClass, "border-emerald-200 bg-emerald-50 text-emerald-700")}
              >
                {t("practiceSelfCorrect")}
              </button>
              <button
                type="button"
                disabled={selfMarking}
                onClick={() => onSelfMark(question.id, 0)}
                className={cn(controlClass, "border-coral-200 bg-coral-50 text-coral-700")}
              >
                {t("practiceSelfWrong")}
              </button>
            </div>
          )}
        </div>
      )}
      {answered.explanation && (
        <div className="mt-2">
          <div className="font-bold text-neutral-700">{t("practiceExplanation")}</div>
          <p className="mt-1 whitespace-pre-line text-neutral-600">{answered.explanation}</p>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  answered,
  submitting,
  selfMarking,
  finished,
  onSubmit,
  onSelfMark,
}: {
  question: SafeQuestion;
  answered: AnsweredState | undefined;
  submitting: boolean;
  selfMarking: boolean;
  finished: boolean;
  onSubmit: (question: SafeQuestion, answer: string) => void;
  onSelfMark: (questionId: string, isCorrect: 0 | 1) => void;
}) {
  const t = useTranslations("competitions");
  const [value, setValue] = useState<string>("");
  const [multi, setMulti] = useState<string[]>([]);
  const done = Boolean(answered);

  return (
    <li className="rounded-lg border border-neutral-200 bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="rounded bg-indigo-700 px-2 py-0.5 font-mono text-[11px] font-bold text-white">{question.seq}</span>
        <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-800">{t(QUESTION_TYPE_LABEL_KEYS[question.type])}</span>
        <span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-600">{t("practicePoints", { points: question.points })}</span>
        {done && <span className="ml-auto" />}
      </div>
      <p className="mt-2.5 text-[14px] leading-7 font-bold whitespace-pre-line text-neutral-800">{question.stem}</p>

      {question.options && question.options.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {question.options.map((option) => {
            const checked = question.type === "multiple" ? multi.includes(option.key) : value === option.key;
            return (
              <label
                key={option.key}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-[13px] transition-colors",
                  checked ? "border-indigo-500 bg-indigo-50 font-bold text-indigo-900" : "border-neutral-200 bg-card text-neutral-700 hover:border-indigo-300",
                  done && "cursor-default opacity-90"
                )}
              >
                <input
                  type={question.type === "multiple" ? "checkbox" : "radio"}
                  name={`q-${question.id}`}
                  className="size-4 accent-indigo-700"
                  disabled={done || finished}
                  checked={checked}
                  onChange={() => {
                    if (question.type === "multiple") {
                      setMulti((prev) => (prev.includes(option.key) ? prev.filter((key) => key !== option.key) : [...prev, option.key]));
                    } else {
                      setValue(option.key);
                    }
                  }}
                />
                <span className="font-mono font-bold">{option.key}.</span>
                <span className="leading-6">{option.text}</span>
              </label>
            );
          })}
        </div>
      )}

      {question.type === "fill" && (
        <input
          type="text"
          value={value}
          disabled={done || finished}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t("practiceFillPlaceholder")}
          className={cn(controlClass, "mt-2 w-full max-w-md font-normal")}
        />
      )}

      {question.type === "essay" && (
        <textarea
          value={value}
          disabled={done || finished}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t("practiceEssayPlaceholder")}
          rows={4}
          className={cn(controlClass, "mt-2 w-full font-normal")}
        />
      )}

      {!done && !finished && (
        <div className="mt-3">
          <button
            type="button"
            disabled={submitting || (question.type === "multiple" ? multi.length === 0 : value.trim() === "")}
            onClick={() => onSubmit(question, question.type === "multiple" ? [...multi].sort().join("") : value)}
            className={cn(
              controlClass,
              "border-indigo-700 bg-indigo-700 text-white hover:border-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {t("practiceSubmit")}
          </button>
        </div>
      )}

      {answered && <AnswerPanel question={question} answered={answered} onSelfMark={onSelfMark} selfMarking={selfMarking} />}
    </li>
  );
}

export function PracticeRunner({ paperId }: { paperId: string }) {
  const t = useTranslations("competitions");
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [questions, setQuestions] = useState<SafeQuestion[]>([]);
  const [answered, setAnswered] = useState<Map<string, AnsweredState>>(new Map());
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [selfMarking, setSelfMarking] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [autoGradablePoints, setAutoGradablePoints] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sessionResp, questionsResp] = await Promise.all([
          fetch("/api/practice/session", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ paperId, mode: "practice" }),
          }),
          fetch(`/api/papers/${encodeURIComponent(paperId)}/questions`, { credentials: "same-origin" }),
        ]);
        if (!sessionResp.ok) throw new Error(`session HTTP ${sessionResp.status}`);
        if (!questionsResp.ok) throw new Error(`questions HTTP ${questionsResp.status}`);
        const sessionData = (await sessionResp.json()).data;
        const questionsData = (await questionsResp.json()).data;
        if (cancelled) return;
        setSession(sessionData.session);
        setAutoGradablePoints(questionsData.autoGradablePoints ?? 0);
        setQuestions(questionsData.questions);
        const restored = new Map<string, AnsweredState>();
        for (const answer of sessionData.answers ?? []) {
          const question = (questionsData.questions as SafeQuestion[]).find((item) => item.id === answer.questionId);
          restored.set(answer.questionId, {
            userAnswer: answer.userAnswer,
            isCorrect: answer.isCorrect,
            correctAnswer: (question as PaperQuestion | undefined)?.answer ?? "",
            explanation: (question as PaperQuestion | undefined)?.explanation ?? null,
            selfMarked: answer.selfMarked === 1,
          });
        }
        setAnswered(restored);
        setPhase("ready");
      } catch (cause) {
        if (!cancelled) {
          setError(String(cause));
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paperId]);

  const handleSubmit = useCallback(
    async (question: SafeQuestion, answer: string) => {
      if (!session) return;
      setSubmitting(question.id);
      try {
        const resp = await fetch("/api/practice/answer", {
          method: "POST",
          headers: { "content-type": "application/json", "idempotency-key": newIdempotencyKey() },
          body: JSON.stringify({ sessionId: session.sessionId, questionId: question.id, answer, idempotencyKey: newIdempotencyKey() }),
        });
        if (!resp.ok) throw new Error(`answer HTTP ${resp.status}`);
        const payload = (await resp.json()).data;
        setAnswered((prev) => {
          const next = new Map(prev);
          next.set(question.id, {
            userAnswer: answer,
            isCorrect: payload.grade.isCorrect,
            correctAnswer: payload.correctAnswer,
            explanation: payload.explanation,
          });
          return next;
        });
        setSession((prev) => (prev ? { ...prev, answeredCount: prev.answeredCount + 1 } : prev));
      } finally {
        setSubmitting(null);
      }
    },
    [session]
  );

  const handleSelfMark = useCallback(
    async (questionId: string, isCorrect: 0 | 1) => {
      setSelfMarking(questionId);
      try {
        const resp = await fetch("/api/practice/self-mark", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paperId, questionId, isCorrect }),
        });
        if (!resp.ok) throw new Error(`self-mark HTTP ${resp.status}`);
        setAnswered((prev) => {
          const next = new Map(prev);
          const existing = next.get(questionId);
          if (existing) next.set(questionId, { ...existing, isCorrect, selfMarked: true });
          return next;
        });
      } finally {
        setSelfMarking(null);
      }
    },
    [paperId]
  );

  const handleFinish = useCallback(async () => {
    if (!session) return;
    setFinishing(true);
    try {
      const resp = await fetch("/api/practice/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      if (!resp.ok) throw new Error(`finish HTTP ${resp.status}`);
      const payload = (await resp.json()).data;
      setSession(payload.session);
    } finally {
      setFinishing(false);
    }
  }, [session]);

  const correctCount = useMemo(() => [...answered.values()].filter((item) => item.isCorrect === 1).length, [answered]);
  const finished = session?.status === "finished";

  if (phase === "loading") {
    return (
      <div className="flex items-center gap-2 p-10 text-sm text-neutral-500">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        {t("practiceLoading")}
      </div>
    );
  }
  if (phase === "error") {
    return <div className="rounded-lg border border-coral-200 bg-coral-50 p-6 text-sm text-coral-700">{t("practiceLoadError", { error: error ?? "" })}</div>;
  }

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white/95 px-1 py-3 backdrop-blur">
        <div className="text-[13px] font-bold text-neutral-700">
          {t("practiceProgress", { answered: answered.size, total: questions.length, correct: correctCount })}
        </div>
        {autoGradablePoints > 0 && (
          <div className="text-[12px] text-neutral-500">{t("practiceAutoPoints", { points: autoGradablePoints })}</div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Link href="/competitions/papers/wrong-book" className={cn(controlClass, "inline-flex items-center gap-1.5 text-indigo-800")}>
            {t("wrongBookEntry")}
          </Link>
          {!finished && (
            <button
              type="button"
              onClick={handleFinish}
              disabled={finishing}
              className={cn(controlClass, "inline-flex items-center gap-1.5 border-coral-600 bg-coral-600 text-white hover:border-coral-600")}
            >
              {finishing ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Flag aria-hidden="true" className="size-4" />}
              {t("practiceFinish")}
            </button>
          )}
        </div>
      </div>

      {finished && session && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="text-lg font-extrabold text-emerald-900">{t("practiceFinishedTitle")}</div>
          <div className="mt-1 text-[14px] text-emerald-800">
            {session.score !== null
              ? t("practiceFinishedScore", { score: session.score, answered: session.answeredCount, total: questions.length })
              : t("practiceFinishedNoScore", { answered: session.answeredCount, total: questions.length })}
          </div>
        </div>
      )}

      <ol className="mt-4 space-y-4">
        {questions.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            answered={answered.get(question.id)}
            submitting={submitting === question.id}
            selfMarking={selfMarking === question.id}
            finished={Boolean(finished)}
            onSubmit={handleSubmit}
            onSelfMark={handleSelfMark}
          />
        ))}
      </ol>
    </div>
  );
}
