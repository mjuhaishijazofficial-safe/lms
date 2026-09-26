import { CircleCheck, ChevronDown } from "lucide-react";
import { plural } from "@/lib/format";
import type { MaterialCardData } from "@/server/services/library";
import { MaterialCard, MaterialGrid } from "./material-card";

export type AccordionChapter = { id: string; title: string; description: string; chapterNumber: number; materials: MaterialCardData[] };

/**
 * Chapters as expandable rows, as in the reference. Built on <details>, so it opens and closes without JavaScript
 * and works with the keyboard. The chapter the student is heading to is open by default.
 */
export function ChapterAccordion({ chapters, openId, completed }: { chapters: AccordionChapter[]; openId?: string; completed: ReadonlySet<string> }) {
  return (
    <div className="space-y-3">
      {chapters.map((c) => {
        const allDone = c.materials.length > 0 && c.materials.every((m) => completed.has(m.id));
        return (
          <details key={c.id} id={`chapter-${c.id}`} open={c.id === openId} className="group card overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center gap-4 p-4 outline-none transition hover:bg-page/50 focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/20 sm:px-5 [&::-webkit-details-marker]:hidden">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full tile-blue text-lg font-semibold">{c.chapterNumber}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-semibold">{c.title}</span>
                {c.description && <span className="block truncate text-muted">{c.description}</span>}
              </span>
              {allDone && <CircleCheck className="size-5 shrink-0 text-success" aria-label="Chapter completed" />}
              <span className="hidden shrink-0 text-muted sm:block">{plural(c.materials.length, "material")}</span>
              <ChevronDown className="size-5 shrink-0 text-ink/70 transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="border-t border-line p-4 sm:p-5">
              {c.materials.length === 0 ? (
                <p className="py-4 text-center text-muted">No study material has been added to this chapter yet.</p>
              ) : (
                <MaterialGrid>
                  {c.materials.map((m) => <MaterialCard key={m.id} material={m} completed={completed.has(m.id)} />)}
                </MaterialGrid>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
