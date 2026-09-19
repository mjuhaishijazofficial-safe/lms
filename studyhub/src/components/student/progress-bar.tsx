import type { Progress } from "@/lib/progress";
import { cn } from "@/lib/format";

/** A thin rounded bar. Exposed to assistive tech as a real progressbar. */
export function ProgressBar({ percent, label, className }: { percent: number; label: string; className?: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className={cn("h-2 overflow-hidden rounded-full bg-page", className)}>
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** "Overall Progress · 3 / 12 chapters · 25%", the white card in the subject header. */
export function ProgressCard({ progress, title = "Overall Progress" }: { progress: Progress; title?: string }) {
  return (
    <div className="w-full min-w-64 rounded-2xl border border-line bg-surface p-4 shadow-card sm:w-72">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted">{progress.completedChapters} / {progress.totalChapters} chapters</p>
      </div>
      <ProgressBar percent={progress.percent} label={title} className="mt-3" />
      <p className="mt-1.5 text-right text-sm text-muted">{progress.percent}%</p>
    </div>
  );
}
