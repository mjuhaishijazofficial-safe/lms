"use client";

import { useState } from "react";
import type { SemesterTree } from "@/server/services/semesters";
import { TERMS } from "@/lib/terms";
import { Field, invalid } from "@/components/ui/field";

/**
 * A program select and the semester select that follows it. Only ids are submitted; the server
 * re-checks that the semester really belongs to the program, so tampering with the form changes nothing.
 */
export function ProgramSemesterFields({ tree, courseId: initialCourse = "", semesterId: initialSemester = "", programRequired, semesterRequired, noProgramLabel, noSemesterLabel, errors = {}, semesterHint }: {
  tree: SemesterTree; courseId?: string; semesterId?: string; programRequired?: boolean;
  /** No "none" choice: the empty option is only a prompt (courses always sit in a semester; students may default). */
  semesterRequired?: boolean;
  noProgramLabel: string; noSemesterLabel: string;
  errors?: { courseId?: string[]; semesterId?: string[] }; semesterHint?: string;
}) {
  const [courseId, setCourseId] = useState(initialCourse);
  const [semesterId, setSemesterId] = useState(initialSemester);
  const semesters = tree.find((c) => c.id === courseId)?.semesters ?? [];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <Field id="courseId" label={TERMS.program} required={programRequired} error={errors.courseId}>
        <select
          id="courseId" name="courseId" value={courseId} required={programRequired} className={`select ${invalid(errors.courseId)}`}
          onChange={(e) => { setCourseId(e.target.value); setSemesterId(""); }}
        >
          <option value="" disabled={programRequired}>{noProgramLabel}</option>
          {tree.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field
        id="semesterId" label={TERMS.semester} required={semesterRequired} error={errors.semesterId}
        hint={errors.semesterId ? undefined : semesterRequired && courseId && semesters.length === 0
          ? `This ${TERMS.programLower} has no ${TERMS.semesters.toLowerCase()} yet. Add them on its ${TERMS.programLower} page first.`
          : semesterHint}
      >
        <select
          id="semesterId" name="semesterId" value={semesterId} required={semesterRequired} disabled={!courseId || semesters.length === 0}
          className={`select ${invalid(errors.semesterId)}`}
          onChange={(e) => setSemesterId(e.target.value)}
        >
          <option value="" disabled={semesterRequired}>{courseId && semesters.length === 0 ? `No ${TERMS.semesters.toLowerCase()} yet` : noSemesterLabel}</option>
          {semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
    </div>
  );
}
