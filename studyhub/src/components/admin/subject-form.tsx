"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { FormState } from "@/server/action-result";
import type { SemesterTree } from "@/server/services/semesters";
import { createSubjectAction, updateSubjectAction } from "@/app/admin/subjects/actions";
import { SUBJECT_ICON_KEYS, SUBJECT_ICONS } from "@/lib/subject-icons";
import { cn } from "@/lib/format";
import { TERMS } from "@/lib/terms";
import { Alert } from "@/components/ui/notice";
import { Field, invalid } from "@/components/ui/field";
import { IconTile } from "@/components/ui/icon-tile";
import { STATUS_OPTIONS } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { ProgramSemesterFields } from "./program-semester-fields";

type Initial = { id: string; courseId: string; semesterId: string; name: string; description: string; icon: string; status: string };

export function SubjectForm({ subject, tree, defaultCourseId, defaultSemesterId }: {
  subject?: Initial; tree: SemesterTree; defaultCourseId?: string; defaultSemesterId?: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(subject ? updateSubjectAction : createSubjectAction, {});
  const v = (k: keyof Initial, fallback = "") => state.values?.[k] ?? subject?.[k] ?? fallback;
  const e = state.fieldErrors ?? {};
  const [icon, setIcon] = useState(v("icon", "book"));

  return (
    <form action={action} className="card max-w-2xl space-y-5 p-6 sm:p-8" noValidate>
      {subject && <input type="hidden" name="id" value={subject.id} />}
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <ProgramSemesterFields
        tree={tree} programRequired semesterRequired errors={e}
        courseId={v("courseId", defaultCourseId ?? "")} semesterId={v("semesterId", defaultSemesterId ?? "")}
        noProgramLabel={`Choose a ${TERMS.programLower}…`} noSemesterLabel={`Choose a ${TERMS.semesterLower}…`}
        semesterHint={`Students see this subject from this ${TERMS.semesterLower} onwards.`}
      />
      <Field id="name" label="Subject name" required error={e.name}>
        <input id="name" name="name" defaultValue={v("name")} required maxLength={120} className={`input ${invalid(e.name)}`} placeholder="CS301 - Data Structures" />
      </Field>
      <Field id="description" label="Description" error={e.description} hint="Shown to students on the subject page.">
        <textarea id="description" name="description" defaultValue={v("description")} maxLength={500} className={`textarea ${invalid(e.description)}`} />
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Icon</legend>
        <input type="hidden" name="icon" value={icon} />
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Subject icon">
          {SUBJECT_ICON_KEYS.map((key) => (
            <button
              key={key} type="button" role="radio" aria-checked={icon === key} aria-label={SUBJECT_ICONS[key].label} title={SUBJECT_ICONS[key].label}
              onClick={() => setIcon(key)}
              className={cn("rounded-2xl p-1 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25", icon === key ? "ring-2 ring-primary" : "ring-1 ring-line hover:ring-primary/40")}
            >
              <IconTile icon={SUBJECT_ICONS[key].icon} className={SUBJECT_ICONS[key].tile} />
            </button>
          ))}
        </div>
        {e.icon && <p className="mt-1.5 text-sm text-danger">{e.icon[0]}</p>}
      </fieldset>

      <Field id="status" label="Status" error={e.status}>
        <select id="status" name="status" defaultValue={v("status", "PUBLISHED")} className="select">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton pendingText="Saving…">{subject ? "Save changes" : "Create subject"}</SubmitButton>
        <Link href="/admin/subjects" className="btn-outline">Cancel</Link>
      </div>
    </form>
  );
}
