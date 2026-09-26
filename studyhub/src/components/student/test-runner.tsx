"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { AttemptView } from "@/server/services/test-attempts";
import { OPTION_LETTERS } from "@/lib/lesson";
import { cn } from "@/lib/format";
import { answerTestAction, startTestAction, submitTestAction } from "@/app/(student)/tests/actions";

type OkView = Extract<AttemptView, { access: "ok" }>;

function mmss(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Runs a test end to end: the start screen, the timed question form (with autosave), then the result. The
 * server, not this component, decides the score and enforces the time limit — this only reflects that back. */
export function TestRunner({ initial }: { initial: OkView }) {
  const [view, setView] = useState<OkView>(initial);
  if (view.phase === "not-started") return <StartScreen view={view} onStarted={setView} />;
  if (view.phase === "in-progress") return <InProgress view={view} onDone={setView} />;
  return <Results view={view} />;
}

function StartScreen({ view, onStarted }: { view: OkView & { phase: "not-started" }; onStarted: (v: OkView) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const res = await startTestAction(view.testId);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    if (res.data.access === "ok") onStarted(res.data);
  }

  return (
    <div className="card max-w-xl space-y-4 p-6 sm:p-8">
      {view.description && <p className="text-sm">{view.description}</p>}
      <div className="flex flex-wrap gap-4 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5"><Clock className="size-4" aria-hidden /> {view.durationMinutes} minutes</span>
        <span>{view.totalQuestions} question{view.totalQuestions === 1 ? "" : "s"}</span>
      </div>
      <div className="rounded-xl bg-page p-4 text-sm text-muted">
        You get one attempt. Once you start, the clock does not stop — even if you close this tab and come back.
        You will see your score as soon as you submit.
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="button" className="btn-primary" onClick={() => void start()} disabled={busy}>
        {busy ? "Starting…" : "Start test"}
      </button>
    </div>
  );
}

function InProgress({ view, onDone }: { view: OkView & { phase: "in-progress" }; onDone: (v: OkView) => void }) {
  const [answers, setAnswers] = useState(view.answers);
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, (new Date(view.deadline).getTime() - Date.now()) / 1000));
  const [warning, setWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  async function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    const res = await submitTestAction(view.testId, view.attemptId);
    setSubmitting(false);
    if (!res.ok) { submittedRef.current = false; setWarning(res.error); return; }
    if (res.data.access === "ok") onDone(res.data);
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const left = (new Date(view.deadline).getTime() - Date.now()) / 1000;
      setSecondsLeft(Math.max(0, left));
      if (left <= 0) void submit();
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- submit is stable enough for a once-per-second tick
  }, [view.deadline]);

  async function choose(qi: number, oi: number) {
    setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)));
    const res = await answerTestAction(view.attemptId, qi, oi);
    if (!res.ok) setWarning("Your last answer may not have saved — check your connection.");
    else setWarning(null);
  }

  const answered = answers.filter((a) => a !== null).length;
  const low = secondsLeft < 60;

  return (
    <div className="space-y-5 pb-24">
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="min-w-0">
          <p className="truncate font-semibold">{view.title}</p>
          <p className="text-sm text-muted">{answered} of {view.totalQuestions} answered</p>
        </div>
        <div className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums", low ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary")}>
          <Clock className="size-4" aria-hidden /> {mmss(secondsLeft)}
        </div>
      </div>

      {warning && (
        <div className="flex items-center gap-2 rounded-xl bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
          <AlertTriangle className="size-4 shrink-0" aria-hidden /> {warning}
        </div>
      )}

      <div className="space-y-4">
        {view.questions.map((q, qi) => (
          <fieldset key={qi} className="card p-5">
            <legend className="mb-3 text-sm font-medium">{qi + 1}. {q.question}</legend>
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <label key={oi} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition", answers[qi] === oi ? "border-primary bg-primary-soft/60" : "border-line hover:bg-page/60")}>
                  <input type="radio" name={`q-${qi}`} checked={answers[qi] === oi} onChange={() => void choose(qi, oi)} className="size-4 accent-[var(--color-primary)]" />
                  <span><strong className="mr-1.5 text-muted">{OPTION_LETTERS[oi]}.</strong>{opt}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="text-sm text-muted">{answered} of {view.totalQuestions} answered</p>
          <button type="button" className="btn-primary" onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit test"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Results({ view }: { view: OkView & { phase: "done" } }) {
  return (
    <div className="space-y-5">
      <div className="card max-w-xl space-y-2 p-6 sm:p-8">
        <p className="text-3xl font-bold text-primary">{view.score} / {view.totalQuestions}</p>
        <p className="text-sm text-muted">Submitted {new Date(view.submittedAt).toLocaleString()}</p>
      </div>

      <div className="space-y-4">
        {view.questions.map((q, qi) => {
          const picked = view.answers[qi];
          const correct = picked === q.answer;
          return (
            <div key={qi} className={cn("card space-y-2 border-l-4 p-5", correct ? "border-l-emerald-400" : "border-l-red-400")}>
              <p className="flex items-start gap-2 text-sm font-medium">
                {correct ? <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-success" aria-hidden /> : <XCircle className="mt-0.5 size-4.5 shrink-0 text-danger" aria-hidden />}
                {qi + 1}. {q.question}
              </p>
              <div className="space-y-1.5 pl-6.5 text-sm">
                {q.options.map((opt, oi) => (
                  <p key={oi} className={cn(
                    "rounded-lg px-3 py-1.5",
                    oi === q.answer ? "bg-success-soft text-success" : oi === picked ? "bg-danger-soft text-danger" : "text-muted",
                  )}>
                    <strong className="mr-1.5">{OPTION_LETTERS[oi]}.</strong>{opt}
                    {oi === q.answer && <span className="ml-2 text-xs font-medium">Correct answer</span>}
                    {oi === picked && oi !== q.answer && <span className="ml-2 text-xs font-medium">Your answer</span>}
                  </p>
                ))}
                {picked === null && <p className="text-xs text-muted">You left this one blank.</p>}
              </div>
              {q.explanation && <p className="pl-6.5 text-sm text-muted">{q.explanation}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
