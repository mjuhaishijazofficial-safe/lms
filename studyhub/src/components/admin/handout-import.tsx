"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, FileUp, Loader2, Play, RotateCcw, Square } from "lucide-react";
import { chapterLabel, chunkText, splitHandout, type HandoutChapter } from "@/lib/handout";
import { MAX_CHARS_PER_REQUEST, mergeLesson, questionsPerPiece, type NotesPart } from "@/lib/lesson-build";
import { costOf, estimateRun, estimateTokens, formatDollars, formatTokens, type Prices, type TokenUsage } from "@/lib/ai-cost";
import { PdfReadError, extractPdfPages } from "@/lib/pdf-text";
import type { Lesson } from "@/lib/lesson";
import type { LessonState } from "@/server/services/handouts";
import {
  generateMcqsAction, generateNotesAction, lessonStatesAction, publishLessonsAction, saveLessonAction,
} from "@/app/admin/handouts/actions";
import { Alert } from "@/components/ui/notice";
import { cn } from "@/lib/format";

type SubjectGroup = { key: string; course: string; subjects: { id: string; name: string }[] };
export type AiSetup = { ready: boolean; model: string | null; inputPerM: number | null; outputPerM: number | null };

type Row = { id: string; number: number; title: string; text: string; include: boolean };
type Run = { state: "waiting" | "working" | "done" | "failed"; note: string; usage?: TokenUsage; warnings?: string[] };

const ZERO: TokenUsage = { inputTokens: 0, outputTokens: 0 };
const FATAL = new Set(["auth", "quota", "config"]);
const MAX_IN_A_ROW = 3;

export function HandoutImport({ subjects, ai }: { subjects: SubjectGroup[]; ai: AiSetup }) {
  const prices: Prices = { inputPerM: ai.inputPerM, outputPerM: ai.outputPerM };
  const [subjectId, setSubjectId] = useState("");
  const [phase, setPhase] = useState<"pick" | "reading" | "review">("pick");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [mcqCount, setMcqCount] = useState(10);
  const [states, setStates] = useState<Map<number, LessonState>>(new Map());
  const [runs, setRuns] = useState<Map<string, Run>>(new Map());
  const [running, setRunning] = useState(false);
  const [usage, setUsage] = useState<TokenUsage>(ZERO);
  const [notice, setNotice] = useState<string | null>(null);
  const stop = useRef(false);

  const reloadStates = useCallback(async (id: string) => {
    if (!id) return setStates(new Map());
    const r = await lessonStatesAction(id);
    if (r.ok) setStates(new Map(r.states.map((s) => [s.number, s])));
  }, []);

  // Which lessons of the chosen subject already have a study guide, so a run does not redo them by accident.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (phase === "review") void reloadStates(subjectId);
  }, [subjectId, phase, reloadStates]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNotice(null);
    setRuns(new Map());
    setUsage(ZERO);
    setFileName(file.name);
    setPhase("reading");
    setProgress({ done: 0, total: 0 });
    try {
      const pages = await extractPdfPages(file, (done, total) => setProgress({ done, total }));
      const chapters: HandoutChapter[] = splitHandout(pages);
      if (chapters.length === 0) throw new PdfReadError("No lessons could be found in this PDF.");
      setRows(chapters.map((c, i) => ({ id: `r${i}`, number: c.number ?? i + 1, title: chapterLabel(c), text: c.text, include: true })));
      setPhase("review");
    } catch (err) {
      setError(err instanceof PdfReadError ? err.message : "This file could not be read. Try a different PDF.");
      setPhase("pick");
    }
  }

  const rowStatus = (r: Row) => states.get(r.number);
  const selected = rows.filter((r) => r.include);
  const estimate = estimateRun(selected.map((r) => r.text.length), prices);

  const update = (id: string, patch: Partial<Run>) =>
    setRuns((prev) => new Map(prev).set(id, { ...(prev.get(id) ?? { state: "waiting", note: "" }), ...patch }));
  const addUsage = (u: TokenUsage) => setUsage((prev) => ({ inputTokens: prev.inputTokens + u.inputTokens, outputTokens: prev.outputTokens + u.outputTokens }));

  /** Builds one lesson from several small requests, then saves it as a draft. Returns a fatal error message, if any. */
  async function buildLesson(row: Row): Promise<{ fatal?: string; failed?: string }> {
    const pieces = chunkText(row.text, MAX_CHARS_PER_REQUEST);
    const label = (i: number) => (pieces.length > 1 ? `${row.title} (part ${i + 1} of ${pieces.length})` : row.title);
    const used: TokenUsage = { ...ZERO };
    const warnings: string[] = [];
    const notes: NotesPart[] = [];
    const mcqs: Lesson["mcqs"][] = [];

    for (const [i, text] of pieces.entries()) {
      if (stop.current) return { failed: "Stopped." };
      update(row.id, { note: `Writing notes${pieces.length > 1 ? ` (${i + 1}/${pieces.length})` : ""}…` });
      const r = await generateNotesAction({ label: label(i), text });
      if (!r.ok) return FATAL.has(r.kind) ? { fatal: r.error } : { failed: r.error };
      used.inputTokens += r.usage.inputTokens;
      used.outputTokens += r.usage.outputTokens;
      addUsage(r.usage);
      notes.push(r.notes);
    }

    if (mcqCount > 0) {
      const count = questionsPerPiece(mcqCount, pieces.length);
      for (const [i, text] of pieces.entries()) {
        if (stop.current) return { failed: "Stopped." };
        update(row.id, { note: `Writing questions${pieces.length > 1 ? ` (${i + 1}/${pieces.length})` : ""}…` });
        const r = await generateMcqsAction({ label: label(i), text, count });
        if (!r.ok) {
          if (FATAL.has(r.kind)) return { fatal: r.error };
          // The notes are the lesson: keep them and say the questions are missing, rather than losing paid-for work.
          warnings.push("The practice questions could not be written. Run this lesson again to retry them.");
          continue;
        }
        used.inputTokens += r.usage.inputTokens;
        used.outputTokens += r.usage.outputTokens;
        addUsage(r.usage);
        if (r.dropped > 0) warnings.push(`${r.dropped} malformed question${r.dropped === 1 ? " was" : "s were"} discarded.`);
        mcqs.push(r.mcqs);
      }
    }

    update(row.id, { note: "Saving as a draft…" });
    const saved = await saveLessonAction({ subjectId, number: row.number, title: row.title, lesson: mergeLesson({ notes, mcqs, mcqCount }) });
    if (!saved.ok) return { failed: saved.error };
    update(row.id, { state: "done", note: saved.replaced ? "Saved (replaced the earlier draft)" : "Saved as a draft", usage: used, warnings });
    return {};
  }

  async function run(list: Row[]) {
    if (!subjectId) return setError("Choose the subject these lessons belong to first.");
    if (!ai.ready) return setError("Lesson generation is not set up yet.");
    setError(null);
    setNotice(null);
    stop.current = false;
    setRunning(true);
    setRuns((prev) => {
      const next = new Map(prev);
      for (const r of list) next.set(r.id, { state: "waiting", note: "Waiting…" });
      return next;
    });

    let inARow = 0;
    for (const row of list) {
      if (stop.current) break;
      update(row.id, { state: "working", note: "Starting…" });
      let outcome: { fatal?: string; failed?: string };
      try {
        outcome = await buildLesson(row);
      } catch {
        outcome = { failed: "Something went wrong. Please try again." };
      }
      if (outcome.fatal) {
        update(row.id, { state: "failed", note: outcome.fatal });
        setError(outcome.fatal);
        break;
      }
      if (outcome.failed) {
        update(row.id, { state: "failed", note: outcome.failed });
        if (++inARow >= MAX_IN_A_ROW) {
          setError(`${MAX_IN_A_ROW} lessons in a row failed, so the run was stopped. Check the message on each lesson, then try again.`);
          break;
        }
      } else {
        inARow = 0;
      }
    }
    setRunning(false);
    // Lessons that never got their turn (the run was stopped or hit a problem) go back to blank rather than "Waiting…".
    setRuns((prev) => new Map([...prev].filter(([, r]) => r.state !== "waiting")));
    await reloadStates(subjectId);
  }

  async function publishDrafts() {
    const numbers = [...states.values()].filter((s) => s.status === "DRAFT").map((s) => s.number);
    const r = await publishLessonsAction(subjectId, numbers);
    if (!r.ok) return setError(r.error);
    setNotice(`${r.published} lesson${r.published === 1 ? " is" : "s are"} now visible to students.`);
    await reloadStates(subjectId);
  }

  const drafts = [...states.values()].filter((s) => s.status === "DRAFT").length;
  const finished = [...runs.values()].filter((r) => r.state === "done").length;
  const failedRows = rows.filter((r) => runs.get(r.id)?.state === "failed");
  const spent = costOf(usage, prices);

  return (
    <div className="space-y-6">
      {!ai.ready && (
        <Alert tone="error">
          Lesson generation is not set up yet. In your hosting settings, add <strong>OPENAI_API_KEY</strong> and <strong>OPENAI_MODEL</strong>.
          You can still read a handout and check how it splits; the Generate buttons stay off until then.
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <section className="card max-w-3xl space-y-5 p-6 sm:p-8">
        <div>
          <h2 className="text-lg font-semibold">1. Choose the subject and the handout</h2>
          <p className="mt-1 text-sm text-muted">
            Each lesson in the handout becomes a chapter of this subject, with a study guide inside. Everything is saved as a draft that only you can see.
          </p>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Subject</span>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="select" disabled={running}>
            <option value="">Choose a subject…</option>
            {subjects.map((g) => (
              <optgroup key={g.key} label={g.course}>{g.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Handout (PDF)</span>
          <input
            type="file" accept="application/pdf,.pdf" disabled={running || phase === "reading"}
            onChange={(e) => void onFile(e.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:font-semibold file:text-white"
          />
          <span className="mt-1.5 block text-xs text-muted">The PDF is read in your browser. Only its text is sent on, so a large file is fine.</span>
        </label>
        {phase === "reading" && (
          <div role="status" className="space-y-2">
            <p className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" aria-hidden /> Reading {fileName}… page {progress.done} of {progress.total || "?"}</p>
            <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-primary transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 5}%` }} /></div>
          </div>
        )}
      </section>

      {phase === "review" && (
        <section className="card space-y-5 p-6 sm:p-8">
          <div>
            <h2 className="text-lg font-semibold">2. Check the lessons that were found</h2>
            <p className="mt-1 text-sm text-muted">
              Found <strong>{rows.length}</strong> lessons in {fileName}. Untick any you do not want, and fix a title if it looks wrong.
            </p>
          </div>

          <div className="max-h-96 overflow-auto rounded-xl border border-line">
            <table className="w-full table-fixed text-sm">
              <thead className="sticky top-0 bg-page text-left text-muted">
                <tr>
                  <th className="w-10 px-3 py-2.5"><span className="sr-only">Include</span></th>
                  <th className="w-[46%] px-3 py-2.5 font-medium">Lesson</th>
                  <th className="w-28 px-3 py-2.5 font-medium">Size</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const state = rowStatus(r);
                  const runState = runs.get(r.id);
                  return (
                    <tr key={r.id} className="border-t border-line align-top">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox" checked={r.include} disabled={running} aria-label={`Include ${r.title}`}
                          onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, include: e.target.checked } : x)))}
                          className="size-4 accent-[var(--color-primary)]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={r.title} disabled={running} aria-label={`Title for lesson ${r.number}`}
                          onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, title: e.target.value } : x)))}
                          className="input h-9 py-1 text-sm"
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted">{r.text.length.toLocaleString()} chars</td>
                      <td className="px-3 py-2">
                        {runState ? <RunBadge run={runState} /> : state ? (
                          <span className="text-xs text-muted">Already has a study guide ({state.status === "DRAFT" ? "draft" : "published"})</span>
                        ) : <span className="text-xs text-muted">New</span>}
                        {runState?.warnings?.map((w) => <p key={w} className="mt-1 text-xs text-amber-800">{w}</p>)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-end gap-6 border-t border-line pt-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Practice questions per lesson</span>
              <select value={mcqCount} onChange={(e) => setMcqCount(Number(e.target.value))} className="select w-32" disabled={running}>
                {[0, 5, 10, 15, 20].map((n) => <option key={n} value={n}>{n === 0 ? "None" : n}</option>)}
              </select>
            </label>
            <div className="text-sm">
              <p className="font-medium">{selected.length} lesson{selected.length === 1 ? "" : "s"} selected</p>
              <p className="text-muted">
                About {formatTokens(estimate.usage.inputTokens)} tokens in, {formatTokens(estimate.usage.outputTokens)} out
                {estimate.dollars !== null ? <> · roughly <strong>{formatDollars(estimate.dollars)}</strong></> : " · set the prices to see a cost estimate"}
              </p>
              <p className="text-xs text-muted">A guess until you run one lesson: then this page shows what it really used.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button" className="btn-primary" disabled={running || !ai.ready || !subjectId || selected.length === 0}
              onClick={() => void run(selected.slice(0, 1))}
            >
              <Play className="size-4.5" aria-hidden /> Try the first lesson only
            </button>
            <button
              type="button" className="btn-outline" disabled={running || !ai.ready || !subjectId || selected.length < 2}
              onClick={() => void run(selected)}
            >
              Generate all {selected.length}
            </button>
            {running && (
              <button type="button" className="btn-outline" onClick={() => { stop.current = true; }}>
                <Square className="size-4" aria-hidden /> Stop after this lesson
              </button>
            )}
            {!running && failedRows.length > 0 && (
              <button type="button" className="btn-soft" onClick={() => void run(failedRows)}>
                <RotateCcw className="size-4" aria-hidden /> Retry the {failedRows.length} that failed
              </button>
            )}
          </div>
          {!subjectId && <p className="text-sm text-muted">Choose a subject above to enable generating.</p>}

          {(usage.inputTokens > 0 || usage.outputTokens > 0) && (
            <div className="rounded-xl bg-page p-4 text-sm" role="status">
              <p className="font-medium">
                Used so far: {formatTokens(usage.inputTokens)} tokens in, {formatTokens(usage.outputTokens)} out
                {spent !== null && <> · <strong>{formatDollars(spent)}</strong></>}
              </p>
              {finished > 0 && spent !== null && (
                <p className="text-muted">
                  About {formatDollars(spent / finished)} per lesson. {selected.length > finished && <>All {selected.length} would come to roughly {formatDollars((spent / finished) * selected.length)}.</>}
                </p>
              )}
              <p className="mt-1 text-xs text-muted">Check the real figure on your OpenAI Usage page. Estimates use ~{estimateTokens(1000)} tokens per 1,000 characters.</p>
            </div>
          )}
        </section>
      )}

      {phase === "review" && (finished > 0 || drafts > 0) && (
        <section className="card max-w-3xl space-y-4 p-6 sm:p-8">
          <h2 className="text-lg font-semibold">3. Review, then publish</h2>
          <p className="text-sm text-muted">
            Nothing is visible to students yet. Open a few lessons and skim the questions: a wrong answer marked correct would teach students
            something false. Look under <Link href="/admin/materials" className="font-medium text-primary hover:underline">Materials</Link> for the ones called “Study guide”.
          </p>
          <button type="button" className="btn-primary" disabled={running || drafts === 0} onClick={() => void publishDrafts()}>
            <FileUp className="size-4.5" aria-hidden /> Publish all {drafts} draft lesson{drafts === 1 ? "" : "s"} of this subject
          </button>
        </section>
      )}
    </div>
  );
}

function RunBadge({ run }: { run: Run }) {
  const tone = run.state === "done" ? "text-teal-700" : run.state === "failed" ? "text-rose-800" : "text-muted";
  return (
    <span className={cn("inline-flex items-start gap-1.5 text-xs", tone)}>
      {run.state === "done" ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        : run.state === "failed" ? <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        : run.state === "working" ? <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" aria-hidden /> : null}
      <span>{run.note}{run.usage ? ` · ${formatTokens(run.usage.inputTokens + run.usage.outputTokens)} tokens` : ""}</span>
    </span>
  );
}
