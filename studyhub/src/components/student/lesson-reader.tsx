"use client";

import { useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { OPTION_LETTERS, lessonTabs, type Lesson } from "@/lib/lesson";
import { cn } from "@/lib/format";

/**
 * A lesson read inside the app. The lesson arrives already validated and sanitised by the server page, so the
 * topic bodies are safe to render as HTML here.
 */
export function LessonReader({ lesson, downloadHref }: { lesson: Lesson; downloadHref: string }) {
  const tabs = lessonTabs(lesson);
  const [tab, setTab] = useState<string>(tabs[0]?.[0] ?? "summary");
  const [hideAnswers, setHideAnswers] = useState(false);
  const [shown, setShown] = useState<Set<number>>(new Set());

  const toggleShown = (i: number) =>
    setShown((prev) => {
      const next = new Set(prev);
      if (!next.delete(i)) next.add(i);
      return next;
    });

  return (
    <div className="space-y-5">
      {lesson.subtitle && <p className="text-muted">{lesson.subtitle}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {tabs.length > 1 ? (
          <div role="tablist" aria-label="Lesson sections" className="inline-flex flex-wrap gap-1 rounded-2xl border border-line bg-surface p-1.5">
            {tabs.map(([key, label, count]) => (
              <button
                key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                className={cn("rounded-xl px-4 py-2 text-sm font-semibold transition", tab === key ? "bg-primary text-white" : "text-primary hover:bg-primary-soft")}
              >
                {label} <span className={cn("ml-1 text-xs", tab === key ? "text-white/80" : "text-muted")}>{count}</span>
              </button>
            ))}
          </div>
        ) : <span />}
        <a href={downloadHref} className="btn-outline"><Download className="size-4.5" aria-hidden /> Download this lesson</a>
      </div>

      {tab === "summary" && (
        <div className="space-y-3">
          {lesson.topics.map((t, i) => (
            <details key={i} open={i === 0} className="lesson-topic card overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4 font-semibold [&::-webkit-details-marker]:hidden">
                <span className="inline-flex h-8.5 min-w-8.5 items-center justify-center rounded-lg bg-primary-soft px-2 text-xs font-bold text-primary">{t.ref ?? i + 1}</span>
                <span className="min-w-0 flex-1">{t.title}</span>
                <ChevronDown className="lesson-chevron size-5 shrink-0 text-muted transition" aria-hidden />
              </summary>
              <div className="lesson-body px-4 pb-5" dangerouslySetInnerHTML={{ __html: t.body }} />
            </details>
          ))}
        </div>
      )}

      {tab === "definitions" && (
        <div className="space-y-3">
          {lesson.definitions.map((d, i) => (
            <div key={i} className="card space-y-2 p-4">
              <p className="font-bold text-primary">{d.term}</p>
              <p className="text-sm">{d.definition}</p>
              {d.example && <p className="rounded-lg bg-page px-3 py-2 text-sm italic text-muted">{d.example}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === "mcqs" && (
        <div className="space-y-4">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input
              type="checkbox" checked={hideAnswers} className="size-4 accent-[var(--color-primary)]"
              onChange={(e) => { setHideAnswers(e.target.checked); setShown(new Set()); }}
            />
            Hide answers so I can test myself
          </label>
          {lesson.mcqs.map((m, i) => {
            const reveal = !hideAnswers || shown.has(i);
            return (
              <div key={i} className="card space-y-3 p-5">
                <span className="inline-block rounded-full bg-primary-soft px-3 py-0.5 text-xs font-bold text-primary">Question {i + 1} of {lesson.mcqs.length}</span>
                <p className="font-semibold">{m.question}</p>
                <div className="space-y-2">
                  {m.options.map((o, oi) => (
                    <div
                      key={oi}
                      className={cn("flex items-start gap-3 rounded-xl border p-3 text-sm", reveal && oi === m.answer ? "border-success bg-success-soft" : "border-line")}
                    >
                      <span className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold", reveal && oi === m.answer ? "bg-success text-white" : "bg-primary-soft text-primary")}>
                        {OPTION_LETTERS[oi]}
                      </span>
                      <span>{o}</span>
                    </div>
                  ))}
                </div>
                {reveal ? (
                  <div className="rounded-xl bg-success-soft p-3 text-sm text-success">
                    <strong>Answer: {OPTION_LETTERS[m.answer]}) {m.options[m.answer]}</strong>
                    {m.explanation && <><br />{m.explanation}</>}
                  </div>
                ) : (
                  <button type="button" onClick={() => toggleShown(i)} className="btn-soft">Show answer</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
