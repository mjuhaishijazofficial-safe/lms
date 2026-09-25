"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, FileCode2, Loader2, Trash2, UploadCloud } from "lucide-react";
import { createChapterFromGuideAction } from "@/app/admin/chapters/guide-actions";
import { guideInfo, naturalCompare } from "@/lib/guide-info";
import { questionsFromArrays, type HtmlQuestion } from "@/lib/html-mcq-import";
import { HtmlReadError, readHtmlArrays } from "@/lib/html-sandbox";
import { titleFromFileName } from "@/lib/filename";
import { cn, formatDateTime, plural } from "@/lib/format";
import { toLocalInputValue } from "./schedule-field";

type SubjectGroup = { key: string; course: string; subjects: { id: string; name: string }[] };
type Release = "scheduled" | "now" | "hidden";
type Row = {
  key: number; file: File; title: string; materialTitle: string; description: string;
  questions: HtmlQuestion[] | null; readError?: string;
  state: "reading" | "ready" | "saving" | "done" | "failed"; message?: string;
  result?: { chapterId: string; chapterNumber: number; testId: string | null };
};

const DAY = 86_400_000;

/**
 * One study guide in, one whole chapter out: drop the week's HTML guides for a subject and each becomes the next
 * chapter, with the guide attached and a practice test from its MCQs, released one after another on a schedule.
 * Files are read here in the browser (the MCQs in a sandbox); each chapter is then created by its own request.
 */
export function GuideChaptersForm({ groups, nextNumbers, defaultSubjectId, maxMb }: {
  groups: SubjectGroup[]; nextNumbers: Record<string, number>; defaultSubjectId?: string; maxMb: number;
}) {
  const [subjectId, setSubjectId] = useState(defaultSubjectId ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [release, setRelease] = useState<Release>("scheduled");
  const [firstLocal, setFirstLocal] = useState("");
  const [everyDays, setEveryDays] = useState(7);
  const [makeTest, setMakeTest] = useState(true);
  const [minutes, setMinutes] = useState(30);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const nextKey = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  const patch = (key: number, next: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...next } : r)));
  const firstNumber = subjectId ? nextNumbers[subjectId] ?? 1 : 1;
  const firstDate = firstLocal ? new Date(firstLocal) : null;
  const dateFor = (i: number) => (firstDate && !Number.isNaN(firstDate.getTime()) ? new Date(firstDate.getTime() + i * everyDays * DAY) : null);

  async function addFiles(list: FileList | File[]) {
    if (!firstLocal) {
      // Tomorrow at 8:00 in the admin's own time — set here (not during render) so it is always the browser's clock.
      const t = new Date(Date.now() + DAY);
      t.setHours(8, 0, 0, 0);
      setFirstLocal(toLocalInputValue(t.toISOString()));
    }
    const added: Row[] = [...list].sort((a, b) => naturalCompare(a.name, b.name)).map((file) => {
      const key = nextKey.current++;
      const tooBig = file.size > maxMb * 1_048_576;
      const notHtml = !/\.html?$/i.test(file.name);
      const readError = notHtml ? "Not an HTML study guide (.html)." : tooBig ? `Larger than ${maxMb} MB.` : undefined;
      return { key, file, title: titleFromFileName(file.name), materialTitle: titleFromFileName(file.name), description: "", questions: readError ? [] : null, readError, state: readError ? "failed" : "reading" };
    });
    setRows((prev) => [...prev, ...added].sort((a, b) => naturalCompare(a.file.name, b.file.name)));

    // Read one at a time: each runs the guide in its own short-lived sandbox.
    for (const row of added) {
      if (row.readError) continue;
      try {
        const source = await row.file.text();
        const info = guideInfo(source, row.file.name);
        let questions: HtmlQuestion[] = [];
        try { questions = questionsFromArrays(await readHtmlArrays(row.file)).questions; } catch (err) { if (!(err instanceof HtmlReadError)) throw err; }
        patch(row.key, { title: info.title, description: info.description, questions, state: "ready" });
      } catch {
        patch(row.key, { questions: [], state: "failed", readError: "This file could not be read." });
      }
    }
  }

  function move(key: number, dir: -1 | 1) {
    setRows((prev) => {
      const i = prev.findIndex((r) => r.key === key), j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  // A file that couldn't be read takes no chapter number and no release date.
  const slot = new Map(rows.filter((r) => !r.readError).map((r, i) => [r.key, i]));
  const pending = rows.filter((r) => r.state === "ready" || (r.state === "failed" && !r.readError));
  const canStart = !!subjectId && pending.length > 0 && !running && !rows.some((r) => r.state === "reading") && (release !== "scheduled" || !!firstDate);

  async function createAll() {
    setRunning(true);
    for (const row of rows) {
      if (!(row.state === "ready" || (row.state === "failed" && !row.readError))) continue;
      patch(row.key, { state: "saving", message: undefined });
      const fd = new FormData();
      fd.set("subjectId", subjectId);
      fd.set("title", row.title);
      fd.set("description", row.description);
      fd.set("materialTitle", row.materialTitle);
      fd.set("release", release);
      fd.set("publishAt", release === "scheduled" ? dateFor(slot.get(row.key) ?? 0)?.toISOString() ?? "" : "");
      const withTest = makeTest && (row.questions?.length ?? 0) > 0;
      fd.set("makeTest", withTest ? "1" : "");
      fd.set("durationMinutes", String(minutes));
      if (withTest) fd.set("questionsJson", JSON.stringify(row.questions!.map(({ question, options, answer, explanation }) => ({ question, options, answer, ...(explanation ? { explanation } : {}) }))));
      fd.set("file", row.file);
      try {
        const res = await createChapterFromGuideAction(fd);
        patch(row.key, res.ok ? { state: "done", result: res } : { state: "failed", message: res.error });
      } catch {
        patch(row.key, { state: "failed", message: "The connection dropped. Press the button again to retry this one." });
      }
    }
    setRunning(false);
  }

  const done = rows.filter((r) => r.state === "done");

  return (
    <div className="space-y-5">
      {/* 1. Subject */}
      <section className="card space-y-3 p-5 sm:p-6">
        <h2 className="font-semibold">1. Which course?</h2>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={running} className="select max-w-xl" aria-label="Course">
          <option value="" disabled>Choose a course…</option>
          {groups.map((g) => (
            <optgroup key={g.key} label={g.course}>
              {g.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </optgroup>
          ))}
        </select>
        {subjectId && <p className="text-sm text-muted">New chapters will be numbered from Chapter {firstNumber}.</p>}
      </section>

      {/* 2. Files */}
      <section className="card space-y-3 p-5 sm:p-6">
        <h2 className="font-semibold">2. Drop the study guides</h2>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (!running) void addFiles(e.dataTransfer.files); }}
          className={cn("relative rounded-2xl border-2 border-dashed p-6 text-center transition", dragging ? "border-primary bg-primary-soft/40" : "border-line bg-page/50")}
        >
          <UploadCloud className="mx-auto size-8 text-muted" aria-hidden />
          <p className="mt-2 text-sm font-medium">Drop your NotebookLM HTML files here, or <button type="button" className="text-primary underline" onClick={() => input.current?.click()} disabled={running}>choose them</button></p>
          <p className="mt-1 text-xs text-muted">One file becomes one chapter, in file-name order (Lesson 1, Lesson 2 …). Up to {maxMb} MB each.</p>
          <input ref={input} type="file" multiple accept=".html,.htm,text/html" className="sr-only" onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
        </div>

        {rows.length > 0 && (
          <ol className="divide-y divide-line rounded-2xl border border-line">
            {rows.map((r, i) => {
              const n = slot.get(r.key);
              const when = release === "scheduled" && n !== undefined ? dateFor(n) : null;
              return (
                <li key={r.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-tile-blue text-xs font-bold text-primary" title="Chapter number">
                      {r.result?.chapterNumber ?? (n !== undefined ? firstNumber + n : "–")}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <input
                        value={r.title} onChange={(e) => patch(r.key, { title: e.target.value })} maxLength={120}
                        disabled={r.state !== "ready" && r.state !== "failed"} aria-label={`Chapter title for ${r.file.name}`}
                        className="input !py-1.5 text-sm font-medium"
                      />
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <FileCode2 className="size-3.5" aria-hidden /> {r.file.name}
                        {r.state === "reading" && <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" aria-hidden /> reading…</span>}
                        {r.questions && !r.readError && <span>· {r.questions.length ? plural(r.questions.length, "MCQ") : "no MCQs found"}</span>}
                        {when && r.state !== "done" && <span>· opens {formatDateTime(when)}</span>}
                      </p>
                      {(r.readError || r.message) && <p className="flex items-start gap-1 text-xs text-red-600"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {r.readError ?? r.message}</p>}
                      {r.state === "done" && r.result && (
                        <p className="flex flex-wrap items-center gap-x-2 text-xs text-emerald-700">
                          <CheckCircle2 className="size-3.5" aria-hidden /> Chapter {r.result.chapterNumber} created{r.result.testId ? " with its test" : ""}.
                          <Link href={`/admin/materials?chapter=${r.result.chapterId}`} className="font-medium underline">See it</Link>
                          {r.result.testId && <Link href={`/admin/tests/${r.result.testId}`} className="font-medium underline">Check the test</Link>}
                        </p>
                      )}
                    </div>
                  </div>
                  {r.state !== "done" && (
                    <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                      {r.state === "saving" && <Loader2 className="size-4 animate-spin text-primary" aria-label="Creating" />}
                      <button type="button" className="btn-ghost !p-1.5" onClick={() => move(r.key, -1)} disabled={running || i === 0} aria-label={`Move ${r.file.name} up`}><ArrowUp className="size-4" aria-hidden /></button>
                      <button type="button" className="btn-ghost !p-1.5" onClick={() => move(r.key, 1)} disabled={running || i === rows.length - 1} aria-label={`Move ${r.file.name} down`}><ArrowDown className="size-4" aria-hidden /></button>
                      <button type="button" className="btn-ghost !p-1.5 hover:!bg-red-50 hover:!text-red-600" onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))} disabled={running} aria-label={`Remove ${r.file.name}`}><Trash2 className="size-4" aria-hidden /></button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* 3. Release */}
      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="font-semibold">3. When do students get them?</h2>
        <fieldset className="space-y-2.5" disabled={running}>
          <legend className="sr-only">Release</legend>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="radio" name="release" checked={release === "scheduled"} onChange={() => setRelease("scheduled")} className="mt-1 accent-primary" />
            <span className="flex flex-wrap items-center gap-2">
              One at a time: the first on
              <input type="datetime-local" value={firstLocal} onChange={(e) => setFirstLocal(e.target.value)} className="input !w-auto !py-1 text-sm" aria-label="First chapter opens on" />
              then one every
              <input type="number" min={1} max={60} value={everyDays} onChange={(e) => setEveryDays(Math.min(60, Math.max(1, Number(e.target.value) || 1)))} className="input !w-20 !py-1 text-sm" aria-label="Days between chapters" />
              days
            </span>
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="radio" name="release" checked={release === "now"} onChange={() => setRelease("now")} className="accent-primary" /> All of them right now
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="radio" name="release" checked={release === "hidden"} onChange={() => setRelease("hidden")} className="accent-primary" /> Keep them hidden, I&apos;ll publish them myself
          </label>
        </fieldset>
        <label className="flex flex-wrap items-center gap-2.5 border-t border-line pt-4 text-sm">
          <input type="checkbox" checked={makeTest} onChange={(e) => setMakeTest(e.target.checked)} disabled={running} className="accent-primary" />
          Make a practice test from each guide&apos;s MCQs, with
          <input type="number" min={1} max={300} value={minutes} onChange={(e) => setMinutes(Math.min(300, Math.max(1, Number(e.target.value) || 1)))} disabled={running || !makeTest} className="input !w-20 !py-1 text-sm" aria-label="Test time limit in minutes" />
          minutes. It opens together with its chapter.
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={() => void createAll()} disabled={!canStart}>
          {running ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Creating…</> : `Create ${plural(pending.length, "chapter")}`}
        </button>
        {done.length > 0 && !running && <Link href={`/admin/chapters?subject=${subjectId}`} className="btn-outline">Go to chapters</Link>}
        {!subjectId && rows.length > 0 && <p className="text-sm text-amber-800">Choose the course first.</p>}
      </div>
    </div>
  );
}
