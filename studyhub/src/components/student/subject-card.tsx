import Link from "next/link";
import { subjectIcon } from "@/lib/subject-icons";
import { plural } from "@/lib/format";
import { IconTile } from "@/components/ui/icon-tile";
import type { LibrarySubject } from "@/server/services/library";
import { ProgressBar } from "./progress-bar";

/** A subject as a card: icon, name, short description, chapter and material counts, progress. */
export function SubjectCard({ subject: s }: { subject: LibrarySubject }) {
  const icon = subjectIcon(s.icon);
  return (
    <Link href={`/subjects/${s.id}`} className="group flex h-full flex-col rounded-card border border-line bg-surface p-5 shadow-card transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
      <div className="flex items-center gap-4">
        <IconTile icon={icon.icon} size="lg" className={icon.tile} />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold group-hover:text-primary">{s.name}</h3>
          <p className="text-sm text-muted">{plural(s.chapterCount, "chapter")} · {plural(s.materialCount, "material")}</p>
        </div>
      </div>
      {s.description && <p className="mt-3 line-clamp-2 text-sm text-muted">{s.description}</p>}
      <div className="mt-auto pt-4">
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="text-muted">Progress</span>
          <span className="font-medium">{s.progress.percent}%</span>
        </div>
        <ProgressBar percent={s.progress.percent} label={`${s.name} progress`} />
      </div>
    </Link>
  );
}
