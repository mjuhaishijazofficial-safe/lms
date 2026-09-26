import { CalendarRange, ChevronDown } from "lucide-react";
import { plural } from "@/lib/format";
import { TERMS } from "@/lib/terms";
import type { SubjectGroup } from "@/server/services/library";
import { SubjectCard } from "./subject-card";

/**
 * One semester's subjects. The current semester is always open; earlier ones fold away so the page
 * stays focused on what the student is studying now (built on <details>: no JavaScript needed).
 */
export function SemesterGroup({ group, defaultOpen }: { group: SubjectGroup; defaultOpen: boolean }) {
  return (
    <details id={`semester-${group.key}`} open={defaultOpen} className="group card overflow-hidden scroll-mt-6">
      <summary className="flex cursor-pointer list-none items-center gap-4 p-4 outline-none transition hover:bg-page/50 focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/20 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full tile-blue"><CalendarRange className="size-5" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-3 text-lg font-semibold">
            {group.name}
            {group.current && <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">Current {TERMS.semesterLower}</span>}
          </span>
          <span className="block text-muted">{plural(group.subjects.length, "subject")}</span>
        </span>
        <ChevronDown className="size-5 shrink-0 text-ink/70 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-5 border-t border-line p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
        {group.subjects.map((s) => <SubjectCard key={s.id} subject={s} />)}
      </div>
    </details>
  );
}
