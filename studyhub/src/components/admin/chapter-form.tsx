"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { FormState } from "@/server/action-result";
import { createChapterAction, updateChapterAction } from "@/app/admin/chapters/actions";
import { Alert } from "@/components/ui/notice";
import { Field, invalid } from "@/components/ui/field";
import { STATUS_OPTIONS } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { ScheduleField } from "./schedule-field";

type Initial = { id: string; subjectId: string; title: string; chapterNumber: number | string; description: string; status: string; publishAt: string | null };
type Group = { courseId: string; course: string; subjects: { id: string; name: string }[] };

export function ChapterForm({ chapter, groups, defaultSubjectId, suggestedNumber }: {
  chapter?: Initial; groups: Group[]; defaultSubjectId?: string; suggestedNumber?: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(chapter ? updateChapterAction : createChapterAction, {});
  const v = (k: keyof Initial, fallback: string | number = "") => String(state.values?.[k] ?? chapter?.[k] ?? fallback);
  const e = state.fieldErrors ?? {};
  const [status, setStatus] = useState(v("status", "PUBLISHED"));

  return (
    <form action={action} className="card max-w-2xl space-y-5 p-6 sm:p-8" noValidate>
      {chapter && <input type="hidden" name="id" value={chapter.id} />}
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <Field id="subjectId" label="Subject" required error={e.subjectId}>
        <select id="subjectId" name="subjectId" defaultValue={v("subjectId", defaultSubjectId ?? "")} required className={`select ${invalid(e.subjectId)}`}>
          <option value="" disabled>Choose a subject…</option>
          {groups.map((g) => (
            <optgroup key={g.courseId} label={g.course}>
              {g.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </optgroup>
          ))}
        </select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-[8rem_1fr]">
        <Field id="chapterNumber" label="Number" required error={e.chapterNumber}>
          <input id="chapterNumber" name="chapterNumber" type="number" min={0} max={999} inputMode="numeric" defaultValue={v("chapterNumber", suggestedNumber ?? 1)} required className={`input ${invalid(e.chapterNumber)}`} />
        </Field>
        <Field id="title" label="Chapter title" required error={e.title}>
          <input id="title" name="title" defaultValue={v("title")} required maxLength={120} className={`input ${invalid(e.title)}`} placeholder="Real Numbers" />
        </Field>
      </div>

      <Field id="description" label="Description" error={e.description} hint="One line students see under the chapter title.">
        <textarea id="description" name="description" defaultValue={v("description")} maxLength={500} className={`textarea ${invalid(e.description)}`} />
      </Field>
      <Field id="status" label="Status" error={e.status}>
        <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="select">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <ScheduleField status={status} initial={v("publishAt")} error={e.publishAt} />

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton pendingText="Saving…">{chapter ? "Save changes" : "Create chapter"}</SubmitButton>
        <Link href="/admin/chapters" className="btn-outline">Cancel</Link>
      </div>
    </form>
  );
}
