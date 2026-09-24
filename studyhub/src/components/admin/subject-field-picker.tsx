"use client";

import { useState } from "react";
import type { PickerTree } from "@/server/services/materials";
import { Field, invalid } from "@/components/ui/field";
import { TERMS } from "@/lib/terms";

function locate(tree: PickerTree, subjectId?: string) {
  for (const course of tree) if (course.subjects.some((s) => s.id === subjectId)) return course.id;
  return "";
}

/** Two linked selects, program then subject. Only the subject is submitted — the program just narrows the list. */
export function SubjectFieldPicker({ tree, initialSubjectId, error }: { tree: PickerTree; initialSubjectId?: string; error?: string[] }) {
  const [courseId, setCourseId] = useState(locate(tree, initialSubjectId));
  const [subjectId, setSubjectId] = useState(initialSubjectId ?? "");

  const subjects = tree.find((c) => c.id === courseId)?.subjects ?? [];

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field id="picker-course" label={TERMS.program} required>
        <select id="picker-course" value={courseId} className="select" onChange={(e) => { setCourseId(e.target.value); setSubjectId(""); }}>
          <option value="" disabled>Choose a {TERMS.programLower}…</option>
          {tree.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field id="subjectId" label="Subject" required error={error}>
        <select id="subjectId" name="subjectId" value={subjectId} disabled={!courseId} required className={`select ${invalid(error)}`} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="" disabled>{courseId ? (subjects.length ? "Choose a subject…" : "No subjects here") : `${TERMS.program} first`}</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
    </div>
  );
}
