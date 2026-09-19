"use client";

import { useState } from "react";
import type { PickerTree } from "@/server/services/materials";
import { Field, invalid } from "@/components/ui/field";
import { TERMS } from "@/lib/terms";

function locate(tree: PickerTree, chapterId?: string) {
  for (const course of tree) for (const subject of course.subjects) {
    if (subject.chapters.some((c) => c.id === chapterId)) return { courseId: course.id, subjectId: subject.id };
  }
  return { courseId: "", subjectId: "" };
}

/** Three linked selects. Only the chapter is submitted; program and subject just narrow the choices. */
export function ChapterPicker({ tree, initialChapterId, error }: { tree: PickerTree; initialChapterId?: string; error?: string[] }) {
  const start = locate(tree, initialChapterId);
  const [courseId, setCourseId] = useState(start.courseId);
  const [subjectId, setSubjectId] = useState(start.subjectId);
  const [chapterId, setChapterId] = useState(start.courseId ? (initialChapterId ?? "") : "");

  const subjects = tree.find((c) => c.id === courseId)?.subjects ?? [];
  const chapters = subjects.find((s) => s.id === subjectId)?.chapters ?? [];

  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <Field id="picker-course" label={TERMS.program} required>
        <select id="picker-course" value={courseId} className="select" onChange={(e) => { setCourseId(e.target.value); setSubjectId(""); setChapterId(""); }}>
          <option value="" disabled>Choose a {TERMS.programLower}…</option>
          {tree.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field id="picker-subject" label="Subject" required>
        <select id="picker-subject" value={subjectId} disabled={!courseId} className="select" onChange={(e) => { setSubjectId(e.target.value); setChapterId(""); }}>
          <option value="" disabled>{courseId ? (subjects.length ? "Choose a subject…" : "No subjects here") : `${TERMS.program} first`}</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field id="chapterId" label="Chapter" required error={error}>
        <select id="chapterId" name="chapterId" value={chapterId} disabled={!subjectId} required className={`select ${invalid(error)}`} onChange={(e) => setChapterId(e.target.value)}>
          <option value="" disabled>{subjectId ? (chapters.length ? "Choose a chapter…" : "No chapters here") : "Subject first"}</option>
          {chapters.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </Field>
    </div>
  );
}
