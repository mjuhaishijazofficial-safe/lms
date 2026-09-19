import { subjectIcon } from "@/lib/subject-icons";
import type { Progress } from "@/lib/progress";
import { IconTile } from "@/components/ui/icon-tile";
import { ProgressCard } from "./progress-bar";

/** The banner at the top of a subject: big icon, name, program and semester, description, and overall progress. */
export function SubjectHeader({ name, subtitle, description, icon, progress }: {
  name: string; subtitle: string; description: string; icon: string; progress: Progress;
}) {
  const tile = subjectIcon(icon);
  return (
    <section className="relative overflow-hidden rounded-card border border-line bg-linear-to-br from-primary-soft via-white to-primary-soft/50 p-5 shadow-card sm:p-8">
      <svg aria-hidden viewBox="0 0 1200 240" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full text-primary/[0.07]">
        <path fill="currentColor" d="M0 190C220 120 380 250 640 180s360-110 560-40V240H0Z" />
        <path fill="currentColor" d="M0 215C260 170 420 250 700 212s340-60 500-20V240H0Z" />
      </svg>
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 flex-1 basis-96 items-start gap-5">
          <IconTile icon={tile.icon} size="xl" className={tile.tile} />
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{name}</h1>
            <p className="mt-1 text-lg">{subtitle}</p>
            {description && <p className="mt-3 max-w-2xl text-muted">{description}</p>}
          </div>
        </div>
        <ProgressCard progress={progress} />
      </div>
    </section>
  );
}
