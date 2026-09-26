import Link from "next/link";
import { BookOpen, ChevronRight, FileText } from "lucide-react";
import { subjectIcon } from "@/lib/subject-icons";
import { plural } from "@/lib/format";
import { IconTile } from "@/components/ui/icon-tile";
import type { LibrarySubject } from "@/server/services/library";
import { ProgressBar } from "./progress-bar";

/** A subject as a card: coloured icon, name and semester, progress, then chapter and material counts. */
export function SubjectCard({ subject: s }: { subject: LibrarySubject }) {
  const icon = subjectIcon(s.icon, s.id);
  return (
    <Link href={`/subjects/${s.id}`} className="group card flex h-full flex-col p-5 transition hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
      <div className="flex items-center gap-4">
        <IconTile icon={icon.icon} size="lg" className={icon.tile} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-ink group-hover:text-primary">{s.name}</h3>
          <p className="truncate text-sm text-muted">{s.semester?.name ?? "All semesters"}</p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
      </div>
      <div className="mb-4 mt-5 flex items-center gap-3">
        <ProgressBar percent={s.progress.percent} label={`${s.name} progress`} className="flex-1" barClassName={icon.bar} />
        <span className="w-10 text-right text-sm font-medium text-ink">{s.progress.percent}%</span>
      </div>
      <div className="mt-auto flex items-center gap-5 border-t border-line pt-4 text-sm text-muted [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1.5">
        <span><BookOpen className="size-4" aria-hidden />{plural(s.chapterCount, "chapter")}</span>
        <span><FileText className="size-4" aria-hidden />{plural(s.materialCount, "material")}</span>
      </div>
    </Link>
  );
}
