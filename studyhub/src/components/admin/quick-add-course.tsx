"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import type { FormState } from "@/server/action-result";
import { quickAddCourseAction } from "@/app/admin/courses/program-actions";
import { SubmitButton } from "@/components/ui/submit-button";

/** Type a course name, press Enter, and it appears in this semester. The box empties itself for the next one. */
export function QuickAddCourse({ courseId, semesterId, semesterName }: { courseId: string; semesterId: string; semesterName: string }) {
  // The server action itself (not a wrapper), so the box also works before JavaScript loads.
  // Its result carries a `key` that changes on every submit, used to remount the input below.
  const [state, action] = useActionState<FormState, FormData>(quickAddCourseAction, {});
  const input = useRef<HTMLInputElement>(null);
  // Keep typing course after course: focus returns to the box after each submit (not on first render).
  useEffect(() => {
    if (state.key) input.current?.focus();
  }, [state]);

  const error = state.fieldErrors?.name?.[0] ?? state.error;
  const id = `add-${semesterId}`;
  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="semesterId" value={semesterId} />
      <label htmlFor={id} className="sr-only">Add a course to {semesterName}</label>
      <div className="flex gap-2">
        <input
          // A new result remounts the box: empty after a success, still holding the text after an error.
          key={state.key ?? 0}
          ref={input} id={id} name="name" required maxLength={120} autoComplete="off"
          defaultValue={state.success ? "" : state.values?.name}
          placeholder="Add a course, e.g. CS101 - Introduction to Computing"
          aria-invalid={!!error} aria-describedby={error ? `${id}-msg` : undefined}
          className="input !py-2 text-sm"
        />
        <SubmitButton variant="soft" className="shrink-0 !px-4 !py-2 text-sm" pendingText="Adding…">
          <Plus className="size-4" aria-hidden /> Add
        </SubmitButton>
      </div>
      {error && <p id={`${id}-msg`} className="text-sm text-red-600">{error}</p>}
      {state.success && <p className="text-sm text-emerald-700" role="status">{state.success}</p>}
    </form>
  );
}
