"use client";

import { ListOrdered } from "lucide-react";
import { plural } from "@/lib/format";
import { TERMS } from "@/lib/terms";

/** One dropdown to jump to a semester's card, instead of a row of pills that wraps once a program has many semesters. */
export function SemesterJump({ semesters }: { semesters: { id: string; name: string; courseCount: number }[] }) {
  return (
    <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 bg-page/90 px-1 py-2 backdrop-blur">
      <ListOrdered className="size-4 shrink-0 text-muted" aria-hidden />
      <label htmlFor="semester-jump" className="shrink-0 text-sm font-medium text-muted">Jump to</label>
      <select
        id="semester-jump"
        defaultValue=""
        className="select !w-auto !py-1.5 text-sm"
        onChange={(e) => {
          if (e.target.value) document.getElementById(e.target.value)?.scrollIntoView({ behavior: "smooth", block: "start" });
          e.target.value = "";
        }}
      >
        <option value="" disabled>Choose a {TERMS.semesterLower}…</option>
        {semesters.map((s, i) => (
          <option key={s.id} value={`semester-${i + 1}`}>{s.name} · {plural(s.courseCount, "course")}</option>
        ))}
      </select>
    </div>
  );
}
