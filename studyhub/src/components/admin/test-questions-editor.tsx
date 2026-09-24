"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import type { TestQuestion } from "@/lib/test";
import { OPTION_LETTERS } from "@/lib/lesson";
import { cn } from "@/lib/format";

type Draft = { key: number; question: string; options: string[]; answer: number; explanation: string };

const emptyDraft = (key: number): Draft => ({ key, question: "", options: ["", "", "", ""], answer: 0, explanation: "" });

/**
 * Writes the questions for a test by hand: no AI, nothing generated — an admin types each question, its options
 * and which one is correct. State lives here and is serialised into one hidden field on submit, the same way the
 * subject picker turns its ticked boxes into one field; the server only ever sees the clean, validated result.
 */
export function TestQuestionsEditor({ initial }: { initial: TestQuestion[] }) {
  const [items, setItems] = useState<Draft[]>(() =>
    initial.length === 0
      ? [emptyDraft(0)]
      : initial.map((q, i) => ({ key: i, question: q.question, options: [...q.options], answer: q.answer, explanation: q.explanation ?? "" })),
  );
  // Only ever read/written from event handlers below (never during render), seeded just past the initial keys.
  const nextKey = useRef(items.length);

  const patch = (key: number, next: Partial<Draft>) => setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...next } : it)));
  const patchOption = (key: number, i: number, value: string) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, options: it.options.map((o, oi) => (oi === i ? value : o)) } : it)));

  function addOption(key: number) {
    setItems((prev) => prev.map((it) => (it.key === key && it.options.length < 6 ? { ...it, options: [...it.options, ""] } : it)));
  }
  function removeOption(key: number, i: number) {
    setItems((prev) => prev.map((it) => {
      if (it.key !== key || it.options.length <= 2) return it;
      const options = it.options.filter((_, oi) => oi !== i);
      const answer = it.answer === i ? 0 : it.answer > i ? it.answer - 1 : it.answer;
      return { ...it, options, answer };
    }));
  }
  function addQuestion() {
    setItems((prev) => [...prev, emptyDraft(nextKey.current++)]);
  }
  function removeQuestion(key: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev));
  }
  function move(key: number, dir: "up" | "down") {
    setItems((prev) => {
      const i = prev.findIndex((it) => it.key === key);
      const j = dir === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const json = JSON.stringify(items.map((it) => ({
    question: it.question, options: it.options, answer: it.answer,
    ...(it.explanation.trim() ? { explanation: it.explanation.trim() } : {}),
  })));

  return (
    <div className="space-y-4">
      <input type="hidden" name="questionsJson" value={json} />

      {items.map((it, i) => (
        <fieldset key={it.key} className="rounded-2xl border border-line bg-page/40 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <legend className="text-sm font-semibold">Question {i + 1}</legend>
            <div className="flex items-center gap-1">
              <button type="button" className="btn-ghost !p-1.5" disabled={i === 0} onClick={() => move(it.key, "up")} aria-label={`Move question ${i + 1} up`} title="Move up">
                <ChevronUp className="size-4.5" aria-hidden />
              </button>
              <button type="button" className="btn-ghost !p-1.5" disabled={i === items.length - 1} onClick={() => move(it.key, "down")} aria-label={`Move question ${i + 1} down`} title="Move down">
                <ChevronDown className="size-4.5" aria-hidden />
              </button>
              <button
                type="button" className="btn-ghost !p-1.5 hover:!bg-red-50 hover:!text-red-600" disabled={items.length === 1}
                onClick={() => removeQuestion(it.key)} aria-label={`Remove question ${i + 1}`} title="Remove question"
              >
                <Trash2 className="size-4.5" aria-hidden />
              </button>
            </div>
          </div>

          <textarea
            value={it.question} onChange={(e) => patch(it.key, { question: e.target.value })}
            placeholder="Type the question…" rows={2} className="textarea" aria-label={`Question ${i + 1} text`}
          />

          <p className="mb-1.5 mt-3 text-sm font-medium">Options — mark the correct one</p>
          <div className="space-y-2">
            {it.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2.5">
                <input
                  type="radio" checked={it.answer === oi} onChange={() => patch(it.key, { answer: oi })}
                  aria-label={`Option ${OPTION_LETTERS[oi]} is correct`} className="size-4 shrink-0 accent-[var(--color-primary)]"
                />
                <input
                  value={opt} onChange={(e) => patchOption(it.key, oi, e.target.value)}
                  placeholder={`Option ${OPTION_LETTERS[oi]}`} aria-label={`Option ${OPTION_LETTERS[oi]} text`}
                  className={cn("input h-10 flex-1 py-1.5 text-sm", it.answer === oi && "border-primary/50 bg-primary-soft/40")}
                />
                <button
                  type="button" className="btn-ghost !p-1.5" disabled={it.options.length <= 2}
                  onClick={() => removeOption(it.key, oi)} aria-label={`Remove option ${OPTION_LETTERS[oi]}`} title="Remove option"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
          {it.options.length < 6 && (
            <button type="button" className="btn-outline mt-2 !py-1.5 text-sm" onClick={() => addOption(it.key)}>
              <Plus className="size-4" aria-hidden /> Add option
            </button>
          )}

          <input
            value={it.explanation} onChange={(e) => patch(it.key, { explanation: e.target.value })}
            placeholder="Why this is the answer (shown to the student after they submit) — optional"
            className="input mt-3 h-10 text-sm"
          />
        </fieldset>
      ))}

      <div className="flex items-center gap-3">
        <button type="button" className="btn-outline" onClick={addQuestion}>
          <Plus className="size-4.5" aria-hidden /> Add question
        </button>
        <p className="text-sm text-muted">{items.length} question{items.length === 1 ? "" : "s"}</p>
      </div>
    </div>
  );
}
